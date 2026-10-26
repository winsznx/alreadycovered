import type pg from "pg";
import { ulid } from "ulid";

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  createdAt: string;
};

function rowToUser(row: { id: string; email: string; password_hash: string; display_name: string | null; created_at: string }): User {
  return { id: row.id, email: row.email, passwordHash: row.password_hash, displayName: row.display_name, createdAt: row.created_at };
}

export class UserRepository {
  constructor(private readonly pool: pg.Pool) {}

  async createUser(input: { email: string; passwordHash: string; displayName?: string }): Promise<User> {
    const id = ulid();
    const { rows } = await this.pool.query(
      `INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, input.email.toLowerCase().trim(), input.passwordHash, input.displayName ?? null],
    );
    return rowToUser(rows[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.pool.query(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  async getById(id: string): Promise<User | null> {
    const { rows } = await this.pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
    return rows[0] ? rowToUser(rows[0]) : null;
  }
}

export class SessionRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<string> {
    const id = ulid();
    await this.pool.query(`INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`, [
      id,
      userId,
      tokenHash,
      expiresAt.toISOString(),
    ]);
    return id;
  }

  async findValidByTokenHash(tokenHash: string): Promise<{ userId: string } | null> {
    const { rows } = await this.pool.query<{ user_id: string }>(
      `SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > now()`,
      [tokenHash],
    );
    return rows[0] ? { userId: rows[0].user_id } : null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.pool.query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);
  }

  async deleteExpired(): Promise<void> {
    await this.pool.query(`DELETE FROM sessions WHERE expires_at <= now()`);
  }
}
