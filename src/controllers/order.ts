import {
  OrderValidator,
  OrderProductValidator,
  PaymentValidator,
} from "../validation/validators.js";

import { type Request, type Response, type NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import {
  Role,
  Status,
  OrderStatus,
  PaymentStatus,
} from "../generated/prisma/index.js";

interface OrderParams {
  orderId?: string;
}

interface OrderBody {
  status: OrderStatus;
  addressId: number;
  orderProducts: OrderProductBody[];
  userId: number;
  payment?: PaymentBody;
}

interface PaymentBody {
  status: PaymentStatus;
  intent?: string;
  method?: string;
  orderId: number;
}

interface OrderProductBody {
  productId: number;
  name: string;
  size: string;
  quantity: number;
  image: string;
  price: string;
}

function getSubtotal(cart: OrderProductBody[]) {
  return cart.reduce(
    (acc, curr) => (acc += parseFloat(curr.price) * curr.quantity),
    0,
  );
}

async function validateOrder(
  req: Request<OrderParams, any, OrderBody>,
  res: Response,
  next: NextFunction,
) {
  const result = OrderValidator.safeParse(req.body);
  if (!result.success) {
    next(result.error);
  } else {
    req.body = result.data;
    next();
  }
}

async function validateOrderProduct(
  req: Request<OrderParams, any, OrderProductBody[]>,
  res: Response,
  next: NextFunction,
) {
  const result = OrderProductValidator.safeParse(req.body);
  if (!result.success) {
    next(result.error);
  } else {
    req.body = result.data;
    next();
  }
}

async function createOrder(
  req: Request<OrderParams, any, OrderBody>,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) return res.status(403).json({ error: "Unauthorized" });

  try {
    const { status, addressId, orderProducts } = req.body;

    const order = await prisma.order.create({
      data: {
        status,
        addressId,
        userId: req.user.id,
        subtotal: getSubtotal(orderProducts),
      },
    });

    await prisma.orderProduct.createMany({
      data: orderProducts.map((item) => ({ ...item, orderId: order.id })),
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        status: PaymentStatus.UNPAID,
      },
    });

    return res.json({ data: order, message: "Order created with success!" });
  } catch (err) {
    next(err);
  }
}

async function editOrder(
  req: Request<OrderParams, any, OrderBody>,
  res: Response,
  next: NextFunction,
) {
  // Permission Check
  if (!req.user) return res.status(403).json({ error: "Unauthorized" });
  //
  const { orderId } = req.params;
  if (typeof orderId !== "string")
    return res.status(403).json({ error: "Order Id is missing" });

  const checkOrder = await prisma.order.findUnique({
    where: {
      id: parseInt(orderId),
    },
  });

  if (!checkOrder) return res.status(404).json({ error: "Order not found!" });

  if (req.user.id !== checkOrder.userId && req.user.role !== Role.ADMIN)
    return res.status(403).json({ error: "You are not the owner!" });

  try {
    const { status, addressId, userId, payment } = req.body;

    await prisma.order.update({
      where: {
        id: parseInt(orderId),
      },
      data: {
        status,
        addressId,
        userId,
      },
    });
    if (payment) {
      await prisma.payment.update({
        where: {
          orderId: checkOrder.id,
        },
        data: {
          ...payment,
        },
      });
    }

    return res.json({ message: "order updated with success!" });
  } catch (err) {
    next(err);
  }
}

async function getOrders(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(403).json({ error: "Unauthorized" });

  if (req.user.role === Role.ADMIN) {
    const allOrders = await prisma.order.findMany({
      include: {
        payment: true,
        orderProducts: true,
        address: true,
      },
    });
    return res.json({ data: allOrders });
  }
  const myOrders = await prisma.order.findMany({
    where: {
      userId: req.user.id,
    },
  });

  return res.json({ data: myOrders });
}

async function getOneOrder(
  req: Request<OrderParams, any, OrderBody>,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) return res.status(403).json({ error: "Unauthorized" });
  const { orderId } = req.params;
  if (typeof orderId !== "string")
    return res.status(403).json({ error: "order id is missing!" });

  const checkOrder = await prisma.order.findUnique({
    where: {
      id: parseInt(orderId),
    },
    include: {
      payment: true,
      orderProducts: true,
      address: true,
    },
  });

  if (!checkOrder)
    return res.status(404).json({ error: "order does not exist!" });

  if (req.user.role === Role.ADMIN) {
    const order = await prisma.order.findUnique({
      where: {
        id: parseInt(orderId),
      },
    });
    return res.json({ data: order });
  }
  if (checkOrder.userId !== req.user.id)
    return res.status(403).json({ error: "Order is not yours!" });
  return res.json({ data: checkOrder });
}

async function deleteOrder(
  req: Request<OrderParams>,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) return res.status(403).json({ error: "Unauthorized" });

  if (req.user.role !== Role.ADMIN)
    return res.status(403).json({ error: "Unauthorized" });
  const { orderId } = req.params;
  if (typeof orderId !== "string")
    return res.status(403).json({ error: "Order Id is missing" });

  try {
    await prisma.order.delete({
      where: {
        id: parseInt(orderId),
      },
    });
  } catch (err) {
    next(err);
  }
}

export { validateOrder, createOrder, deleteOrder, editOrder, getOneOrder, getOrders };
