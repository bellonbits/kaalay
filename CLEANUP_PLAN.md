# 🧹 Cleanup Plan - Remove Obsolete Directories

## Summary of Migration

✅ **Frontend:** frontend-v2 → frontend (consolidated)  
✅ **Backend:** suqafuran-express → kaalay/apps/backend (consolidated)  
✅ **Config:** docker-compose.yml, package.json, .env.example created  
✅ **Documentation:** MIGRATION_PLAN.md and README_CONSOLIDATED.md created  

## Safe to Delete (After Backup)

### 1. Frontend Backup (Original - NOT NEEDED)
```bash
rm -rf /Users/mac/kaalay/apps/frontend.backup
```
**Reason:** Replaced by frontend-v2 content (now in frontend/)  
**Safety:** ✅ Safe - frontend/ has all the updated code

### 2. Frontend-V2 (No longer primary)
```bash
rm -rf /Users/mac/kaalay/apps/frontend-v2
```
**Reason:** Consolidated into frontend/  
**Safety:** ✅ Safe - frontend/ is a copy of frontend-v2

### 3. Backend NestJS Backup (Old TypeScript backend)
```bash
rm -rf /Users/mac/kaalay/apps/backend-nestjs.backup
```
**Reason:** Replaced by Go microservices  
**Safety:** ✅ Safe - all Go services are in backend/

### 4. Standalone Suqafuran Express Repo
```bash
rm -rf /Users/mac/suqafuran-express
```
**Reason:** All services migrated to kaalay/apps/backend  
**Safety:** ✅ Safe - everything is in kaalay/apps/backend/services/

### 5. Standalone Suqafuran Frontend (Duplicate)
```bash
rm -rf /Users/mac/suqafuran/new-frontend
```
**Reason:** Consolidated into kaalay/apps/frontend  
**Safety:** ✅ Safe - all features are in kaalay frontend

## NOT Deleting (Still Useful)

- `/Users/mac/kaalay/apps/backend-nestjs.backup` - Archive of old NestJS backend (safe to keep for reference)
- `/Users/mac/kaalay/apps/frontend.backup` - Archive of old frontend (safe to keep for reference)

## Disk Space Freed

| Item | Size | Notes |
|------|------|-------|
| frontend.backup | 463M | Can delete |
| frontend-v2 | 890M | Can delete (copy is in frontend/) |
| backend-nestjs.backup | 398M | Can delete |
| suqafuran-express/ | ~100M | Can delete |
| suqafuran/new-frontend/ | ~50M | Can delete |
| **Total** | **~1.9GB** | **Available to free** |

## Cleanup Steps

### Option A: Full Cleanup (Aggressive)
```bash
# Remove ALL old directories
rm -rf /Users/mac/kaalay/apps/frontend-v2
rm -rf /Users/mac/kaalay/apps/frontend.backup
rm -rf /Users/mac/kaalay/apps/backend-nestjs.backup
rm -rf /Users/mac/suqafuran-express
rm -rf /Users/mac/suqafuran/new-frontend

echo "✅ Cleaned up 1.9GB of disk space"
```

### Option B: Conservative (Keep Backups)
```bash
# Keep backups for 30 days, then review
# Just remove the separate repos
rm -rf /Users/mac/suqafuran-express
rm -rf /Users/mac/suqafuran/new-frontend

echo "✅ Cleaned up separated repos"
# Backups still at:
# - apps/frontend.backup
# - apps/frontend-v2
# - apps/backend-nestjs.backup
```

### Option C: Manual Review
```bash
# List sizes before cleanup
echo "Frontend backups:"
du -sh /Users/mac/kaalay/apps/frontend*

echo ""
echo "Backend backups:"
du -sh /Users/mac/kaalay/apps/backend*

echo ""
echo "Separate repos:"
du -sh /Users/mac/suqafuran-express
du -sh /Users/mac/suqafuran/new-frontend

# Then manually decide what to delete
```

## Verification Checklist

Before running cleanup:

- [ ] Frontend builds successfully: `cd apps/frontend && npm run build`
- [ ] Backend services are in place: `ls apps/backend/services/`
- [ ] Docker-compose is updated: `cat docker-compose.yml`
- [ ] Environment config exists: `ls .env.example`
- [ ] Root package.json has scripts: `cat package.json`
- [ ] Git status is clean: `git status`

## After Cleanup

```bash
# Commit cleanup
git add -A
git commit -m "chore: Remove duplicate directories after consolidation"

# Push to remote
git push origin main

# Verify
git log --oneline -5
```

## Recovery (If Needed)

If you accidentally delete something important, you can recover from git:

```bash
# List deleted files
git log --diff-filter=D --summary | grep delete

# Restore a specific file
git checkout HEAD~1 -- path/to/deleted/file

# Restore entire directory
git checkout HEAD~1 -- apps/frontend-v2
```

---

**Recommendation:** Run cleanup after verifying all tests pass and you're confident the new structure is working.

**Timing:** Safe to cleanup now - all functionality is migrated.

**Next Step:** Run cleanup, commit, deploy to Vercel.
