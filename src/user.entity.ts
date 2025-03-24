import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string; // Auto-generated unique ID

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  connectedAccountId: string;
}