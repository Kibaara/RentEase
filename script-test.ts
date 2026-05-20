import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const users = await pool.query('SELECT * FROM users');
  const payments = await pool.query('SELECT * FROM payments');
  const expenses = await pool.query('SELECT * FROM expenses');
  const config = await pool.query('SELECT * FROM config');
  
  console.log("Users:", JSON.stringify(users.rows.map(u => ({id: u.id, name: u.name, rentAmount: u.rentAmount, depositAmount: u.depositAmount, totalBalance: u.totalBalance, moveInDate: u.moveInDate, isMovedIn: u.isMovedIn, garbageFee: u.garbageFee, waterBill: u.waterBill})), null, 2));
  console.log("Payments:", JSON.stringify(payments.rows, null, 2));
  console.log("Config:", JSON.stringify(config.rows, null, 2));
  process.exit(0);
}
run();
