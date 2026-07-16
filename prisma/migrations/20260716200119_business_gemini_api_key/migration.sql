-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'BUSINESS_API_KEY_UPDATED';

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "geminiApiKeyEncrypted" TEXT;
