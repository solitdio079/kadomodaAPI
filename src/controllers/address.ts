import { AddressValidator } from "../validation/validators.js";
import { prisma } from "../lib/prisma.js";

import { type Request, type Response, type NextFunction } from "express";

interface AddressBody {
  name: string;
  zipCode: string;
  city: string;
  country: string;
  phone: string;
  address: string;
  userId: number;
}

interface AddressParams {
  addressId?: string;
}
async function validateAddress(
  req: Request<AddressParams, any, AddressBody>,
  res: Response,
  next: NextFunction,
) {
  const result = AddressValidator.safeParse(req.body);
  if (!result.success) {
    next(result.error);
  } else {
    req.body = result.data;
    next();
  }
}

async function createAddress(
  req: Request<AddressParams, any, AddressBody>,
  res: Response,
  next: NextFunction,
) {
  // Permission checks
  if (!req.user) return res.status(403).json({ error: "Unauthorized" });

  try {
    const { name, zipCode, address, city, country, phone } = req.body;

    const newAddress = await prisma.address.create({
      data: {
        userId: req.user.id,
        name,
        zipcode: zipCode,
        address,
        city,
        country,
        phone,
      },
    });

    return res.json({ data: newAddress });
  } catch (err) {
    next(err);
  }
}

async function editAddress(
  req: Request<AddressParams, any, AddressBody>,
  res: Response,
  next: NextFunction,
) {
  // Permission checks
  if (!req.user) return res.status(403).json({ error: "Unauthorized" });

  const { addressId } = req.params;
  if (typeof addressId !== "string")
    return res.status(403).json({ error: "Address id is not valid!" });

  const checkAddress = await prisma.address.findUnique({
    where: {
      id: parseInt(addressId),
    },
  });

  if (!checkAddress)
    return res.status(404).json({ error: "Address does not exist!" });

  try {
    const { name, zipCode, address, city, country, phone } = req.body;

    const newAddress = await prisma.address.update({
      where: { id: parseInt(addressId) },
      data: {
        userId: req.user.id,
        name,
        zipcode: zipCode,
        address,
        city,
        country,
        phone,
      },
    });

    return res.json({ data: newAddress });
  } catch (err) {
    next(err);
  }
}

async function getUserAddresses(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Permission checks
  if (!req.user) return res.status(403).json({ error: "Unauthorized" });

  try {
    const addresses = await prisma.address.findMany({
      where: {
        userId: req.user.id,
      },
    });

    return res.json({ data: addresses });
  } catch (err) {
    next(err);
  }
}

async function getOneAddress(
  req: Request<AddressParams>,
  res: Response,
  next: NextFunction,
) {
  // Permission checks
  if (!req.user) return res.status(403).json({ error: "Unauthorized" });

  const { addressId } = req.params;
  if (typeof addressId !== "string")
    return res.status(403).json({ error: "Address id is not valid!" });

  const checkAddress = await prisma.address.findUnique({
    where: {
      id: parseInt(addressId),
    },
  });

  if (!checkAddress)
    return res.status(404).json({ error: "Address does not exist!" });

  try {
    const address = await prisma.address.findUnique({
      where: {
        id: parseInt(addressId),
      },
    });

    return res.json({ data: address });
  } catch (err) {
    next(err);
  }
}

async function deleteAddress(
  req: Request<AddressParams>,
  res: Response,
  next: NextFunction,
) {
  // Permission checks
  if (!req.user) return res.status(403).json({ error: "Unauthorized" });
  const { addressId } = req.params;
  if (typeof addressId !== "string")
    return res.status(403).json({ error: "Address id is not valid!" });

  const checkAddress = await prisma.address.findUnique({
    where: {
      id: parseInt(addressId),
    },
  });

  if (!checkAddress)
    return res.status(404).json({ error: "Address does not exist!" });

  try {
    await prisma.address.delete({
      where: {
        id: parseInt(addressId),
      },
    });

    return res.json({ message: "Address deleted successfully!" });
  } catch (err) {
    next(err);
  }
}

export {
  validateAddress,
  createAddress,
  editAddress,
  getUserAddresses,
  getOneAddress,
  deleteAddress,
};
