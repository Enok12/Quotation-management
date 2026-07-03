-- New audit action for customer deletion (which also cascades to their receipts).
ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_DELETED';
