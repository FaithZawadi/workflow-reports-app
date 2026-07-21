-- MMS Training Feedback (public form): participant details + follow-up field.
ALTER TABLE "TrainingFeedback" ADD COLUMN "organization" TEXT;
ALTER TABLE "TrainingFeedback" ADD COLUMN "mode" TEXT;
ALTER TABLE "TrainingFeedback" ADD COLUMN "additionalSupport" TEXT;
