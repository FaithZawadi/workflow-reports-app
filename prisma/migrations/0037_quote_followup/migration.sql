-- Track when the last "still awaiting a decision?" nudge was sent to a quote's preparer.
ALTER TABLE "Quotation" ADD COLUMN "followupSentAt" TIMESTAMP(3);
