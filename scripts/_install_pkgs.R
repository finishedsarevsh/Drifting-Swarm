lib <- file.path(Sys.getenv("USERPROFILE"), "R", "library")
dir.create(lib, recursive = TRUE, showWarnings = FALSE)
.libPaths(c(lib, .libPaths()))
message("Installing to: ", lib)
install.packages(
  c("brfssdata", "dplyr", "readr", "cli", "purrr"),
  lib   = lib,
  repos = "https://cloud.r-project.org",
  type  = "binary"
)
pkgs <- installed.packages(lib.loc = lib)[, "Package"]
message("Done. Installed: ", paste(sort(pkgs), collapse = ", "))
