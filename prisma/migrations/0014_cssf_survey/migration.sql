-- Customer Satisfaction Survey Form (CSSF): make legacy serviceType optional and
-- add the structured survey fields.
ALTER TABLE "ServiceFeedback" ALTER COLUMN "serviceType" DROP NOT NULL;
ALTER TABLE "ServiceFeedback" ADD COLUMN "serviceTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ServiceFeedback" ADD COLUMN "criteria" JSONB;
ALTER TABLE "ServiceFeedback" ADD COLUMN "hadProblem" BOOLEAN;
ALTER TABLE "ServiceFeedback" ADD COLUMN "problemDetail" TEXT;
ALTER TABLE "ServiceFeedback" ADD COLUMN "complaintHandling" TEXT;
ALTER TABLE "ServiceFeedback" ADD COLUMN "didWell" TEXT;
ALTER TABLE "ServiceFeedback" ADD COLUMN "improve" TEXT;
ALTER TABLE "ServiceFeedback" ADD COLUMN "additionalServices" TEXT;
ALTER TABLE "ServiceFeedback" ADD COLUMN "overall" INTEGER;
ALTER TABLE "ServiceFeedback" ADD COLUMN "useAgain" TEXT;
ALTER TABLE "ServiceFeedback" ADD COLUMN "recommend" TEXT;
