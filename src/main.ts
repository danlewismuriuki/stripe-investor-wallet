// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { json, urlencoded } from 'express';
// import { IncomingMessage } from 'http';

// declare module "http" {
//   interface IncomingMessage {
//     rawBody?: Buffer;
//   }
// }

// const PORT = process.env.PORT || 3000;

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);

//   // Middleware: Preserve raw body for Stripe webhooks
//   app.use(
//     json({
//       verify: (req: IncomingMessage, res, buf) => {
//         if (req.headers['stripe-signature']) {
//           req.rawBody = buf; // Preserve raw body for Stripe webhooks
//         }
//       },
//     })
//   );
//   app.use(urlencoded({ extended: true }));

//   await app.listen(PORT);
//   console.log(`🚀 Server running on port ${PORT}`);
// }

// bootstrap();


import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { IncomingMessage } from 'http';

declare module "http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Middleware: Preserve raw body for Stripe webhooks
  app.use(
    json({
      verify: (req: IncomingMessage, res, buf) => {
        if (req.headers['stripe-signature']) {
          req.rawBody = buf; // Preserve raw body for Stripe webhooks
        }
      },
    })
  );
  app.use(urlencoded({ extended: true }));

  await app.listen(PORT);
  console.log(`🚀 Server running on port ${PORT}`);
}

bootstrap();