# PolicyVault Data Retention Policy

**Effective:** March 2025  
**Scope:** All data stored in PolicyVault

---

## Summary

| Data Type | Retention | Notes |
|-----------|-----------|-------|
| **Acknowledgments** | 7 years after employment ends | Legal/compliance standard for employment records |
| **HR Records (write-ups)** | 7 years after employment ends | Employment law; some jurisdictions require longer |
| **Incident Reports** | 7 years | Workplace safety / EEOC |
| **Amendments** | Same as parent record | Tied to HR/incident record lifecycle |
| **System Events** | 7 years | Audit trail |
| **Policy Versions** | Indefinite while policy exists | Referenced by acknowledgments |
| **Employees** | Until deleted + 7 years for related records | Soft-delete recommended |
| **Users** | Until account deleted | Auth only |

---

## Implementation Notes

- **Automated deletion:** Not yet implemented. Consider cron job or scheduled task.
- **Export before delete:** Use `POST /api/export-org-data` for legal hold before purge.
- **Backup retention:** Align backup retention with data retention (e.g., 7 years).

---

## Jurisdiction Considerations

- **US:** EEOC recommends 1 year for charges; many employers keep 7 years.
- **EU (GDPR):** Retention must be justified; document purpose and duration.
- **State laws:** California, New York, etc. may have specific requirements.

---

*Review annually. Update when regulations change.*
