-- DropForeignKey
ALTER TABLE "savings_contributions" DROP CONSTRAINT "savings_contributions_goal_id_fkey";

-- AddForeignKey
ALTER TABLE "savings_contributions" ADD CONSTRAINT "savings_contributions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "savings_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
