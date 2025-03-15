import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { IncomingMessage } from 'http';


// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   await app.listen(process.env.PORT ?? 3000);
// }
// bootstrap();


// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { json, urlencoded } from 'body-parser';
// import { IncomingMessage } from 'http';

declare module "http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);

//   // Middleware
//   app.use(urlencoded({ extended: true }));
//   app.use(json({ verify: (req: IncomingMessage, res, buf) => (req.rawBody = buf) })); // Preserve raw body for Stripe

//   // Start server
//   await app.listen(process.env.PORT ?? 3000);
// }

// bootstrap();

const PORT = process.env.PORT || process.env.WEBHOOK_PORT || 3000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(urlencoded({ extended: true }));
  app.use(json({ verify: (req: IncomingMessage, res, buf) => (req.rawBody = buf) }));

  await app.listen(PORT);
  console.log(`🚀 Server running on port ${PORT}`);
}

bootstrap();

