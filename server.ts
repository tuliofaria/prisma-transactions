import { PrismaClient } from "@prisma/client";
import express from "express";

const app = express();
const prisma = new PrismaClient();

app.get("/users/:user", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: Number(req.params.user) },
    include: { transactions: true },
  });
  res.json(user);
});

app.get("/users", async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.get("/create-user", async (req, res) => {
  const name = req.query.name as string;
  if (!name) return res.send("Please provide a name");

  const user = await prisma.user.create({
    data: { name, balance: 0 },
  });

  res.json(user);
});

app.get("/deposit", async (req, res) => {
  const to = Number(req.query.to || 0);
  const amount = Number(req.query.amount);
  const shouldFail = req.query.shouldFail === "true";

  if (!to || !amount) return res.send("Please provide from, to and amount");

  const toUser = await prisma.user.findUnique({ where: { id: to } });

  if (!toUser) return res.send("User not found");

  try {
    await prisma.$transaction(async (trx) => {
      await trx.transfer.create({
        data: {
          amount,
          userId: toUser.id,
        },
      });

      //
      if (shouldFail) {
        throw new Error("Transaction failed");
      }

      await trx.user.update({
        where: { id: toUser.id },
        data: { balance: toUser.balance + amount },
      });
    });
  } catch (err) {
    return res.send("Error");
  }
  res.send("Deposit successful");
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

app.get("/transfer", async (req, res) => {
  const from = Number(req.query.from || 0);
  const to = Number(req.query.to || 0);
  const amount = Number(req.query.amount);

  if (!from || !to || !amount)
    return res.send("Please provide from, to and amount");

  try {
    await prisma.$transaction(async (trx) => {
      const fromUser = await trx.user.findUnique({ where: { id: from } });
      const toUser = await trx.user.findUnique({ where: { id: to } });

      await sleep(Number(req.query.sleep || 0));

      if (!fromUser || !toUser) return res.send("User not found");

      if (fromUser?.balance < amount) {
        return res.send("Insufficient balance");
      }

      await trx.transfer.create({
        data: {
          amount: -amount,
          userId: fromUser.id,
        },
      });
      await trx.transfer.create({
        data: {
          amount: amount,
          userId: toUser.id,
        },
      });
      await trx.user.update({
        where: { id: fromUser.id },
        data: { balance: fromUser.balance - amount },
      });
      await trx.user.update({
        where: { id: toUser.id },
        data: { balance: toUser.balance + amount },
      });
    });
  } catch (err) {
    return res.send("Error transaction");
  }

  res.send("Transfer successful");
});

app.listen(3002, () => {
  console.log("Server is running on port 3002");
});
