import { createClient } from "./lib/supabase/server"
import { getRecentPayments, getRecentExpenses, getFinancialSummary } from "./app/actions/financial-actions"

async function debugData() {
  console.log("--- DEBUGGING FINANCIAL DATA ---")
  
  const summary = await getFinancialSummary("monthly")
  console.log("Summary:", summary)
  
  const payments = await getRecentPayments(5)
  console.log("Recent Payments count:", payments.length)
  if (payments.length > 0) {
    console.log("First Payment sample:", JSON.stringify(payments[0], null, 2))
  }
  
  const expenses = await getRecentExpenses(5)
  console.log("Recent Expenses count:", expenses.length)
  if (expenses.length > 0) {
    console.log("First Expense sample:", JSON.stringify(expenses[0], null, 2))
  }
}

// We can't run this directly as it's TS and uses server actions
// I'll just check the code again.
