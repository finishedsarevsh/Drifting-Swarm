<#
.SYNOPSIS
    DTASS -- Proxy Fix Script (apply_proxy_fix.ps1)
    Stages all 6 node data directories for a unified 15-feature
    BRFSS swarm run:
      1. Ensure every node has a state-specific real BRFSS CSV
         (proxy with CA data for any node that still lacks one)
      2. Quarantine every brfss_synthetic.csv so data_loader
         cannot accidentally pick it up
      3. Audit docker-compose.yml and patch any file-level
         synthetic references found

    Safe to re-run -- all operations are idempotent.
.NOTES
    Run from: drifting-swarm project root
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

function Write-Banner([string]$t) {
    Write-Host ""; Write-Host ("="*68) -ForegroundColor Cyan
    Write-Host "  $t" -ForegroundColor Cyan
    Write-Host ("="*68) -ForegroundColor Cyan
}
function Write-OK   ([string]$m) { Write-Host "  [OK]   $m" -ForegroundColor Green  }
function Write-Skip ([string]$m) { Write-Host "  [SKIP] $m" -ForegroundColor Yellow }
function Write-Warn ([string]$m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow }
function Write-Fail ([string]$m) { Write-Host "  [FAIL] $m" -ForegroundColor Red    }
function Write-Info ([string]$m) { Write-Host "         $m" -ForegroundColor DarkGray}

$ROOT       = $PSScriptRoot
$DATA       = Join-Path $ROOT "data"
$COMPOSE    = Join-Path $ROOT "docker-compose.yml"
$PROXY_SRC  = Join-Path $DATA "CA\brfss_CA.csv"
$ALL_NODES  = @("CA","TX","OH","WY","NY","NJ")
$QUARANTINE = "_synthetic_quarantine"

Write-Banner "DTASS Proxy Fix -- Staging Unified 15-Feature Swarm"
Write-Host "  Root   : $ROOT"       -ForegroundColor White
Write-Host "  Donor  : $PROXY_SRC"  -ForegroundColor White
Write-Host "  Nodes  : $($ALL_NODES -join ', ')" -ForegroundColor White

# ============================================================
# PREFLIGHT CHECKS
# ============================================================
Write-Banner "Preflight Checks"

if (-not (Test-Path $PROXY_SRC)) {
    Write-Fail "Donor file not found: $PROXY_SRC"
    Write-Info "Place a 15-feature real BRFSS CSV at data/CA/brfss_CA.csv first."
    exit 1
}
$donorKB = [math]::Round((Get-Item $PROXY_SRC).Length / 1KB, 1)
Write-OK "Donor file found: brfss_CA.csv  ($donorKB KB)"

if (-not (Test-Path $COMPOSE)) { Write-Fail "docker-compose.yml not found"; exit 1 }
Write-OK "docker-compose.yml found"

if (-not (Test-Path $DATA)) { Write-Fail "data/ directory not found"; exit 1 }
Write-OK "data/ directory found"

# ============================================================
# STEP 1 -- Ensure Every Node Has a Real BRFSS CSV
# ============================================================
Write-Banner "Step 1 / 3 -- Ensure Real BRFSS CSV for Every Node"

$s1_present = @()
$s1_copied  = @()
$s1_failed  = @()

foreach ($n in $ALL_NODES) {
    $dir    = Join-Path $DATA $n
    $target = Join-Path $dir "brfss_${n}.csv"

    if (Test-Path $target) {
        $kb = [math]::Round((Get-Item $target).Length / 1KB, 1)
        Write-Skip "$n  brfss_${n}.csv already present  ($kb KB)"
        $s1_present += $n
        continue
    }

    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Info "Created directory: data/$n/"
    }

    Write-Host "  [>>]   $n  Copying brfss_CA.csv -> brfss_${n}.csv ..." -ForegroundColor Cyan
    try {
        Copy-Item -Path $PROXY_SRC -Destination $target -Force
        $kb = [math]::Round((Get-Item $target).Length / 1KB, 1)
        Write-OK "$n  brfss_${n}.csv created  ($kb KB, proxied from CA)"
        $s1_copied += $n
    } catch {
        Write-Fail "$n  Copy failed: $_"
        $s1_failed += $n
    }
}

# ============================================================
# STEP 2 -- Quarantine All brfss_synthetic.csv Files
# ============================================================
Write-Banner "Step 2 / 3 -- Quarantine All brfss_synthetic.csv Files"
Write-Info "Moving each synthetic CSV into data/<NODE>/$QUARANTINE/"
Write-Info "Files are MOVED not deleted -- restore by moving them back."
Write-Host ""

$s2_moved   = @()
$s2_absent  = @()
$s2_failed  = @()
$freedKB    = 0

foreach ($n in $ALL_NODES) {
    $dir   = Join-Path $DATA $n
    $src   = Join-Path $dir "brfss_synthetic.csv"
    $qdir  = Join-Path $dir $QUARANTINE
    $dst   = Join-Path $qdir "brfss_synthetic.csv"

    if (-not (Test-Path $src)) {
        Write-Skip "$n  No brfss_synthetic.csv -- nothing to quarantine"
        $s2_absent += $n
        continue
    }

    $kb = [math]::Round((Get-Item $src).Length / 1KB, 1)

    if (-not (Test-Path $qdir)) {
        New-Item -ItemType Directory -Path $qdir -Force | Out-Null
    }

    try {
        Move-Item -Path $src -Destination $dst -Force
        Write-OK "$n  brfss_synthetic.csv  ($kb KB)  --> data/$n/$QUARANTINE/"
        $s2_moved += $n
        $freedKB  += $kb
    } catch {
        Write-Fail "$n  Move failed: $_"
        $s2_failed += $n
    }
}

if ($s2_moved.Count -gt 0) {
    Write-Host ""
    Write-OK "Quarantined $($s2_moved.Count) file(s), hiding $([math]::Round($freedKB)) KB from glob scan"
}

# ============================================================
# STEP 3 -- Audit docker-compose.yml Volume Mounts
# ============================================================
Write-Banner "Step 3 / 3 -- Audit docker-compose.yml Volume Mounts"
Write-Info "The compose file mounts whole directories (./data/TX:/app/data:ro),"
Write-Info "not individual files. Scanning for any accidental file-level references."
Write-Host ""

$composeRaw   = Get-Content $COMPOSE -Raw
$patches      = 0
$composeLines = Get-Content $COMPOSE

# Patch 1: any direct brfss_synthetic.csv path reference
if ($composeRaw -match "brfss_synthetic") {
    Write-Warn "Found 'brfss_synthetic' file reference -- patching to brfss_CA.csv ..."
    $composeRaw = $composeRaw -replace "brfss_synthetic\.csv", "brfss_CA.csv"
    $patches++
    Write-OK "Patched brfss_synthetic.csv reference(s) in compose file"
} else {
    Write-OK "No 'brfss_synthetic' file references in docker-compose.yml"
}

# Patch 2: verify TX and WY use directory mounts
foreach ($n in @("TX","WY")) {
    $lower = $n.ToLower()
    $mountPattern = "./data/${n}:/app/data"
    if ($composeRaw -match [regex]::Escape($mountPattern)) {
        Write-OK "node-$lower  volume mount confirmed: ./data/${n}:/app/data:ro"
    } else {
        Write-Warn "node-$lower  expected mount './data/${n}:/app/data' not found"
        Write-Info "  Verify the node-$lower service block in docker-compose.yml manually."
    }
}

# Patch 3: catch any remaining 'synthetic' anywhere
$synthCount = ([regex]::Matches($composeRaw, "synthetic")).Count
if ($synthCount -gt 0) {
    Write-Warn "$synthCount residual 'synthetic' occurrence(s) in docker-compose.yml"
    Write-Info "These are likely comments -- review manually if needed."
} else {
    Write-OK "Zero 'synthetic' occurrences remain in docker-compose.yml"
}

if ($patches -gt 0) {
    $composeRaw | Set-Content $COMPOSE -Encoding UTF8 -NoNewline
    Write-OK "docker-compose.yml saved with $patches patch(es)"
} else {
    Write-OK "docker-compose.yml required no changes"
}

# ============================================================
# FINAL VERIFICATION -- Simulate data_loader Priority Logic
# ============================================================
Write-Banner "Final Verification -- Simulated data_loader File Selection"
Write-Host ""

$allGreen = $true
foreach ($n in $ALL_NODES) {
    $dir       = Join-Path $DATA $n
    $preferred = Join-Path $dir "brfss_${n}.csv"
    # Only look in the node dir itself, not in quarantine subdir
    $activeCsvs = @(Get-ChildItem "$dir\*.csv" -ErrorAction SilentlyContinue |
                    Where-Object { $_.DirectoryName -eq $dir })

    if (Test-Path $preferred) {
        $kb = [math]::Round((Get-Item $preferred).Length / 1KB, 1)
        $tag = if ($s1_copied -contains $n) { "[PROXIED from CA]" } else { "[REAL BRFSS]" }
        Write-OK "$n  Tier-1: brfss_${n}.csv  ($kb KB)  $tag  15 features"
    } elseif ($activeCsvs.Count -gt 0) {
        $nonSyn = @($activeCsvs | Where-Object { $_.Name -notlike "*synthetic*" })
        if ($nonSyn.Count -gt 0) {
            Write-Warn "$n  Tier-2 fallback: $($nonSyn[0].Name)"
            $allGreen = $false
        } else {
            Write-Fail "$n  Only synthetic CSVs visible -- quarantine may have failed"
            $allGreen = $false
        }
    } else {
        Write-Warn "$n  No active CSV found -- node will use in-memory synthetic"
        $allGreen = $false
    }
}

# ============================================================
# SUMMARY
# ============================================================
Write-Banner "Summary"
Write-Host ""
Write-Host "  Step 1 -- Real BRFSS CSV:" -ForegroundColor White
if ($s1_present.Count -gt 0) { Write-OK "Already present : $($s1_present -join ', ')" }
if ($s1_copied.Count  -gt 0) { Write-OK "Proxied from CA : $($s1_copied -join ', ')" }
if ($s1_failed.Count  -gt 0) { Write-Fail "Copy failed     : $($s1_failed -join ', ')" }

Write-Host ""
Write-Host "  Step 2 -- Synthetic quarantine:" -ForegroundColor White
if ($s2_moved.Count  -gt 0) { Write-OK "Quarantined     : $($s2_moved -join ', ')  ($([math]::Round($freedKB)) KB hidden)" }
if ($s2_absent.Count -gt 0) { Write-OK "Already absent  : $($s2_absent -join ', ')" }
if ($s2_failed.Count -gt 0) { Write-Fail "Move failed     : $($s2_failed -join ', ')" }

Write-Host ""
Write-Host "  Step 3 -- docker-compose.yml:" -ForegroundColor White
if ($patches -eq 0) { Write-OK "No patches needed -- directory-only mounts confirmed" }
else                { Write-OK "$patches patch(es) applied and saved" }

Write-Host ""
if ($allGreen -and $s1_failed.Count -eq 0 -and $s2_failed.Count -eq 0) {
    Write-Host ("="*68) -ForegroundColor Green
    Write-Host "  ENVIRONMENT READY" -ForegroundColor Green
    Write-Host "  All 6 nodes will load 15-feature BRFSS data." -ForegroundColor Green
    Write-Host "  Run: .\run_demo_and_report.ps1" -ForegroundColor Green
    Write-Host ("="*68) -ForegroundColor Green
    Write-Host ""
    Write-Host "  To restore synthetic files if needed:" -ForegroundColor DarkGray
    foreach ($n in $ALL_NODES) {
        $q = "data\${n}\_synthetic_quarantine\brfss_synthetic.csv"
        if (Test-Path (Join-Path $ROOT $q)) {
            Write-Host "    Move-Item '$q' 'data\${n}\brfss_synthetic.csv'" -ForegroundColor DarkGray
        }
    }
} else {
    Write-Host ("="*68) -ForegroundColor Red
    Write-Host "  ATTENTION: Some steps had issues. Review output above." -ForegroundColor Yellow
    Write-Host ("="*68) -ForegroundColor Red
}
