
import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./src/user.entity";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  synchronize: true,
  logging: true,
  entities: [User],
});

AppDataSource.initialize()
  .then(() => console.log("✅ Connected to PostgreSQL with TypeORM"))
  .catch((error) => console.error("❌ Database connection failed:", error));
