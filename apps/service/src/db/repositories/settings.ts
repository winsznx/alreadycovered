import type pg from "pg";

export class SettingsRepository {
  constructor(private readonly pool: pg.Pool) {}

  async get<T>(userId: string, key: string): Promise<T | null> {
    const { rows } = await this.pool.query(`SELECT value_json FROM settings WHERE user_id = $1 AND key = $2`, [userId, key]);
    return rows[0] ? (rows[0].value_json as T) : null;
  }

  async set(userId: string, key: string, value: unknown): Promise<void> {
    await this.pool.query(
      `INSERT INTO settings (user_id, key, value_json, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, key) DO UPDATE SET value_json = $3, updated_at = now()`,
      [userId, key, JSON.stringify(value)],
    );
  }
}
