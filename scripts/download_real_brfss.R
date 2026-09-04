# =============================================================================
# download_real_brfss.R  (v3 — year-aware variable mapping)
#
# Uses exact variable names per BRFSS year as documented in brfss_vars().
# Requests only variables confirmed to exist in each year — no more skips.
#
# Output: data/<STATE>/brfss_<STATE>.csv (drop-in for data_loader.py)
# =============================================================================

# ── 0. Library setup (user-writable path, avoids Program Files permission) ───
user_lib <- file.path(Sys.getenv("USERPROFILE"), "R", "library")
dir.create(user_lib, recursive = TRUE, showWarnings = FALSE)
.libPaths(c(user_lib, .libPaths()))

for (pkg in c("brfssdata", "dplyr", "readr", "cli", "purrr")) {
  if (!requireNamespace(pkg, quietly = TRUE))
    install.packages(pkg, lib = user_lib,
                     repos = "https://cloud.r-project.org", type = "binary")
}
library(brfssdata); library(dplyr); library(readr); library(cli)

STATES <- c("CA", "TX", "OH", "WY", "NY", "NJ")

SCRIPT_DIR <- tryCatch(
  dirname(normalizePath(sys.frame(1)$ofile)),
  error = function(e) {
    args <- commandArgs(trailingOnly = FALSE)
    f    <- args[grep("--file=", args)]
    if (length(f)) dirname(normalizePath(sub("--file=", "", f))) else getwd()
  }
)
DATA_DIR <- normalizePath(file.path(SCRIPT_DIR, "..", "data"))

# ── 1. Year-to-variable map (derived from brfss_vars() ground truth) ─────────
#
# Format:  year_range -> list(TARGET=<varname>, feat_*=<varname>)
# Only variables confirmed to exist in that range are included.
# Years without a TARGET variable are omitted entirely.
#
# Key facts:
#   DIABETES  : 1988-2003   DIABETE2: 2004-2010   DIABETE3: 2011-2018   DIABETE4: 2019-2024
#   _BMI2     : 2000-2002   _BMI4   : 2004-2010   _BMI5   : 2011-2024
#   SEX       : 1985-2017   SEX1    : 2018         SEXVAR  : 2019-2024
#   INCOME2   : 1996-2020   INCOME3 : 2021-2024
#   MEDCOST   : 1991-2020   MEDCOST1: 2021-2024
#   HLTHPLN1  : 2011-2020   (no reliable coverage var outside this range)
#   CHOLCHK   : 1987-2011+  CHOLCHK1: 2017  CHOLCHK2: 2019  CHOLCHK3: 2021,2023
#   _TOTINDA  : stable across all years in our range
#   GENHLTH, PHYSHLTH, MENTHLTH, CHECKUP1, SMOKE100, EDUCA: broadly stable

make_var_map <- function(yr) {
  # TARGET
  target_var <- dplyr::case_when(
    yr >= 2019 ~ "DIABETE4",
    yr >= 2011 ~ "DIABETE3",
    yr >= 2004 ~ "DIABETE2",
    yr >= 1999 ~ "DIABETES",
    TRUE       ~ NA_character_
  )
  if (is.na(target_var)) return(NULL)

  bmi_var <- dplyr::case_when(
    yr >= 2011 ~ "_BMI5",
    yr >= 2004 ~ "_BMI4",
    yr >= 2003 ~ "_BMI3",
    yr >= 2000 ~ "_BMI2",
    TRUE       ~ NA_character_
  )

  sex_var <- dplyr::case_when(
    yr >= 2019 ~ "SEXVAR",
    yr == 2018 ~ "SEX1",
    TRUE       ~ "SEX"
  )

  income_var <- if (yr >= 2021) "INCOME3" else "INCOME2"
  medcost_var <- if (yr >= 2021) "MEDCOST1" else "MEDCOST"

  # Cholesterol check — CHOLCHK is broadly available 1987-2011+
  chol_var <- dplyr::case_when(
    yr == 2023 ~ "CHOLCHK3",
    yr == 2021 ~ "CHOLCHK3",
    yr == 2019 ~ "CHOLCHK2",
    yr == 2017 ~ "CHOLCHK1",
    TRUE       ~ "CHOLCHK"   # 1987-2016 broadly
  )

  # Blood pressure — _RFHYPE5 available odd years 2005+, _RFHYPE6 in 2021/2023
  bp_var <- dplyr::case_when(
    yr %in% c(2021, 2023) ~ "_RFHYPE6",
    yr >= 2005 & yr %% 2 == 1 ~ "_RFHYPE5",  # odd years
    TRUE ~ NA_character_
  )

  # Health coverage — HLTHPLN1: 2011-2020; skip outside
  coverage_var <- if (yr >= 2011 && yr <= 2020) "HLTHPLN1" else NA_character_

  v <- c(
    TARGET       = target_var,
    feat_bmi     = bmi_var,
    feat_sex     = sex_var,
    feat_income  = income_var,
    feat_medcost = medcost_var,
    feat_chol    = chol_var,
    feat_genhlth  = "GENHLTH",
    feat_physhlth = "PHYSHLTH",
    feat_menthlth = "MENTHLTH",
    feat_checkup  = "CHECKUP1",
    feat_smoke    = "SMOKE100",
    feat_educa    = "EDUCA",
    feat_inactive = "_TOTINDA",
    feat_age      = "_AGEG5YR"
  )
  if (!is.na(bp_var))       v["feat_bp"]       <- bp_var
  if (!is.na(coverage_var)) v["feat_coverage"]  <- coverage_var

  na.omit(v)
}

# ── 2. Helpers ────────────────────────────────────────────────────────────────
FIPS_TO_ABBR <- c(
  "6" = "CA", "06" = "CA",
  "48" = "TX", "39" = "OH",
  "56" = "WY", "36" = "NY", "34" = "NJ"
)

#' Derive binary TARGET (1=diabetes, 0=no diabetes, NA=drop)
derive_target <- function(df, target_raw_name) {
  actual <- names(df)[toupper(names(df)) == toupper(target_raw_name)][1]
  if (is.na(actual)) { df$TARGET <- NA_integer_; return(df) }
  raw <- df[[actual]]
  if (is.character(raw)) raw <- suppressWarnings(as.integer(raw))
  df$TARGET <- dplyr::case_when(
    raw == 1L           ~ 1L,
    raw %in% c(3L, 4L) ~ 0L,
    raw == 2L           ~ 0L,   # gestational — treat as negative for simplicity
    TRUE                ~ NA_integer_
  )
  df
}

#' Rename raw columns to canonical feat_* names
add_canonical_cols <- function(df, var_map) {
  for (canon in names(var_map)) {
    if (canon == "TARGET") next
    raw <- var_map[[canon]]
    # find actual column (case-insensitive, handle leading underscore)
    actual <- names(df)[toupper(names(df)) == toupper(raw)][1]
    if (!is.na(actual) && !canon %in% names(df)) {
      df[[canon]] <- suppressWarnings(as.numeric(df[[actual]]))
    }
  }
  df
}

# ── 3. Main loop ──────────────────────────────────────────────────────────────
cli::cli_h1("DTASS Phase 1 — Real BRFSS Data Pipeline (v3)")
cli::cli_alert_info("Cache dir: {.path {brfssdata::brfss_cache_dir()}}")

available_years <- brfssdata::brfss_years()
target_years    <- intersect(1999:2024, available_years)
cli::cli_alert_info("Processing {length(target_years)} years: {min(target_years)}-{max(target_years)}")

state_frames <- setNames(vector("list", length(STATES)), STATES)

for (yr in target_years) {
  var_map <- make_var_map(yr)
  if (is.null(var_map)) {
    cli::cli_alert_warning("Year {yr}: no TARGET variable defined — skipping.")
    next
  }

  raw_vars <- unique(as.character(var_map))
  cli::cli_alert_info("Year {yr} | TARGET={var_map['TARGET']} | {length(raw_vars)} vars")

  batch_raw <- tryCatch(
    brfssdata::read_brfss(years = yr, vars = raw_vars, states = STATES, na = FALSE),
    error = function(e) {
      # If some optional vars still missing, retry with mandatory-only subset
      mandatory <- as.character(var_map[c("TARGET", "feat_genhlth", "feat_physhlth",
                                          "feat_menthlth", "feat_age", "feat_educa")])
      mandatory <- unique(na.omit(mandatory))
      tryCatch(
        brfssdata::read_brfss(years = yr, vars = mandatory, states = STATES, na = FALSE),
        error = function(e2) {
          cli::cli_alert_warning("Year {yr}: fallback also failed — {conditionMessage(e2)}")
          NULL
        }
      )
    }
  )

  if (is.null(batch_raw) || nrow(batch_raw) == 0) {
    cli::cli_alert_warning("Year {yr}: empty result — skipping.")
    next
  }

  # Detect state column
  state_col <- intersect(
    c("_STATE", "X_STATE", "XSTATE", "state_abbr", "STATE", "state"),
    names(batch_raw)
  )[1]
  if (is.na(state_col)) {
    cli::cli_alert_warning("Year {yr}: no state column — skipping.")
    next
  }

  # Normalise state to abbreviation
  sv <- as.character(batch_raw[[state_col]])
  batch_raw$state_derived <- if (all(nchar(na.omit(sv)) == 2)) toupper(sv) else FIPS_TO_ABBR[sv]

  # Derive TARGET
  batch_raw <- derive_target(batch_raw, var_map["TARGET"])
  batch_raw <- batch_raw[!is.na(batch_raw$TARGET), , drop = FALSE]
  if (nrow(batch_raw) == 0) { cli::cli_alert_warning("Year {yr}: all rows NA after TARGET filter."); next }

  # IYEAR
  if (!"IYEAR" %in% names(batch_raw))
    batch_raw$IYEAR <- as.integer(if ("year" %in% names(batch_raw)) batch_raw$year else yr)
  batch_raw$IYEAR <- as.integer(batch_raw$IYEAR)

  # Add canonical feature columns
  batch_raw <- add_canonical_cols(batch_raw, var_map)

  feat_cols <- grep("^feat_", names(batch_raw), value = TRUE)
  keep      <- c("IYEAR", "TARGET", "state_derived", feat_cols)
  batch_raw <- batch_raw[, intersect(keep, names(batch_raw)), drop = FALSE]

  for (st in STATES) {
    rows <- batch_raw[!is.na(batch_raw$state_derived) & batch_raw$state_derived == st, , drop = FALSE]
    if (nrow(rows) == 0) next
    rows$state_derived <- NULL
    state_frames[[st]] <- dplyr::bind_rows(state_frames[[st]], rows)
  }

  cli::cli_alert_success("Year {yr}: {nrow(batch_raw)} usable rows across states.")
}

# ── 4. Write per-state CSVs ───────────────────────────────────────────────────
cli::cli_h2("Writing per-state CSV files")

for (st in STATES) {
  df <- state_frames[[st]]
  if (is.null(df) || nrow(df) == 0) {
    cli::cli_alert_warning("[{st}] No data — skipping.")
    next
  }
  df <- dplyr::arrange(df, IYEAR)
  out_dir  <- file.path(DATA_DIR, st)
  dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
  out_path <- file.path(out_dir, paste0("brfss_", st, ".csv"))
  readr::write_csv(df, out_path)

  n_yrs   <- length(unique(df$IYEAR))
  pct_pos <- round(100 * mean(df$TARGET == 1L, na.rm = TRUE), 1)
  feat_n  <- length(grep("^feat_", names(df)))
  cli::cli_alert_success(
    "[{st}] {format(nrow(df), big.mark=',')} rows | {n_yrs} years | {feat_n} features | {pct_pos}% diabetes"
  )
}

cli::cli_h2("Summary")
ok <- 0L
for (st in STATES) {
  df <- state_frames[[st]]
  if (!is.null(df) && nrow(df) > 0) {
    ok <- ok + 1L
    cli::cli_bullets(c("*" = "{st}: {format(nrow(df), big.mark=',')} rows ({paste(range(df$IYEAR), collapse='-')})"))
  }
}
if (ok == length(STATES)) {
  cli::cli_alert_success("All {length(STATES)} states populated. Run  docker compose up  to start the swarm.")
} else {
  cli::cli_alert_warning("{length(STATES) - ok} state(s) empty — check warnings above.")
}
