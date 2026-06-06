import '../src/config/loadEnv.js';
import { runDailyBillingJobs } from '../src/jobs/billingJobs.js';

const result = await runDailyBillingJobs();
console.log(JSON.stringify(result, null, 2));
process.exit(0);
