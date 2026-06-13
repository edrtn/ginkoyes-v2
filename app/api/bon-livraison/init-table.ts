import { query } from "@/lib/db";

let initialized = false;

export async function ensureBLTable() {
  if (initialized) return;

  await query(`
    CREATE TABLE IF NOT EXISTS bl_analyses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      supplier VARCHAR(255),
      brand VARCHAR(255),
      total_notes INT NOT NULL DEFAULT 0,
      total_articles INT NOT NULL DEFAULT 0,
      total_pieces INT NOT NULL DEFAULT 0,
      parsed_data LONGTEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  initialized = true;
}
