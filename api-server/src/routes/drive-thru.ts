import { Router, type IRouter } from "express";
import { requireAnyAuth } from "./auth.js";
import {
  buildDriveThruVehicle,
  applyDriveThruStatus,
  normalizePlate,
  buildDriveThruOrder,
  createDriveThruLprResult,
  type DriveThruVehicle,
  type DriveThruStatus,
  type DriveThruOrder,
  type DriveThruLprResult,
} from "../lib/drive-thru.js";

const router: IRouter = Router();

const vehiclesByRestaurant = new Map<string, DriveThruVehicle[]>();
const ordersByRestaurant = new Map<string, DriveThruOrder[]>();
const lprResultsByRestaurant = new Map<string, DriveThruLprResult[]>();

function getRestaurantVehicles(restaurantId: string): DriveThruVehicle[] {
  const existing = vehiclesByRestaurant.get(restaurantId) ?? [];
  vehiclesByRestaurant.set(restaurantId, existing);
  return existing;
}

function getRestaurantOrders(restaurantId: string): DriveThruOrder[] {
  const existing = ordersByRestaurant.get(restaurantId) ?? [];
  ordersByRestaurant.set(restaurantId, existing);
  return existing;
}

function getRestaurantLprResults(restaurantId: string): DriveThruLprResult[] {
  const existing = lprResultsByRestaurant.get(restaurantId) ?? [];
  lprResultsByRestaurant.set(restaurantId, existing);
  return existing;
}

router.get("/drive-thru/vehicles", requireAnyAuth, (req, res) => {
  const restaurantId = (req as any).auth.companyId as string;
  const vehicles = getRestaurantVehicles(restaurantId);
  res.json(vehicles.slice().reverse());
});

router.post("/drive-thru/vehicles", requireAnyAuth, (req, res) => {
  const restaurantId = (req as any).auth.companyId as string;
  const { plate, cameraId, source, customerName, orderId, notes } = req.body as {
    plate?: string;
    cameraId?: string;
    source?: 'camera' | 'manual' | 'external';
    customerName?: string;
    orderId?: string;
    notes?: string;
  };

  if (!plate || !plate.trim()) {
    res.status(400).json({ error: "plate é obrigatório" });
    return;
  }

  const normalized = normalizePlate(plate);
  if (!normalized) {
    res.status(400).json({ error: "placa inválida" });
    return;
  }

  const vehicle = buildDriveThruVehicle({
    restaurantId,
    plate: normalized,
    cameraId,
    source: source ?? 'camera',
    customerName,
    orderId,
    notes,
  });

  const list = getRestaurantVehicles(restaurantId);
  list.push(vehicle);
  res.status(201).json(vehicle);
});

router.patch("/drive-thru/vehicles/:id", requireAnyAuth, (req, res) => {
  const restaurantId = (req as any).auth.companyId as string;
  const { id } = req.params;
  const { status, orderId, customerName, notes } = req.body as {
    status?: DriveThruStatus;
    orderId?: string;
    customerName?: string;
    notes?: string;
  };

  const list = getRestaurantVehicles(restaurantId);
  const vehicle = list.find((item) => item.id === id);
  if (!vehicle) {
    res.status(404).json({ error: "veículo não encontrado" });
    return;
  }

  const updated = {
    ...applyDriveThruStatus(vehicle, status ?? vehicle.status),
    ...(orderId ? { orderId } : {}),
    ...(customerName ? { customerName } : {}),
    ...(notes ? { notes } : {}),
  };

  const idx = list.findIndex((item) => item.id === id);
  list[idx] = updated;
  res.json(updated);
});

router.get("/drive-thru/orders", requireAnyAuth, (req, res) => {
  const restaurantId = (req as any).auth.companyId as string;
  const orders = getRestaurantOrders(restaurantId).slice().reverse();
  res.json(orders);
});

router.post("/drive-thru/orders", requireAnyAuth, (req, res) => {
  const restaurantId = (req as any).auth.companyId as string;
  const { vehicleId, plate, orderId, customerName, attendanceId, status, notes, scheduledAt } = req.body as {
    vehicleId?: string;
    plate?: string;
    orderId?: string;
    customerName?: string;
    attendanceId?: string;
    status?: DriveThruStatus;
    notes?: string;
    scheduledAt?: string;
  };

  if (!vehicleId && !plate) {
    res.status(400).json({ error: "vehicleId ou plate é obrigatório" });
    return;
  }

  const normalized = normalizePlate(plate ?? '');
  if (plate && !normalized) {
    res.status(400).json({ error: "placa inválida" });
    return;
  }

  const list = getRestaurantVehicles(restaurantId);
  const vehicle = vehicleId ? list.find((item) => item.id === vehicleId) : undefined;
  if (vehicleId && !vehicle) {
    res.status(404).json({ error: "veículo não pertence a esta loja" });
    return;
  }

  const driveOrder = buildDriveThruOrder({
    restaurantId,
    vehicleId: vehicleId ?? vehicle?.id ?? `vehicle-${Math.random().toString(36).slice(2, 9)}`,
    plate: normalized || vehicle?.plate || plate || '',
    orderId,
    customerName,
    attendanceId,
    status,
    notes,
    scheduledAt,
  });

  const orders = getRestaurantOrders(restaurantId);
  orders.push(driveOrder);
  res.status(201).json(driveOrder);
});

router.get("/drive-thru/lpr", requireAnyAuth, (req, res) => {
  const restaurantId = (req as any).auth.companyId as string;
  const records = getRestaurantLprResults(restaurantId).slice().reverse();
  res.json(records);
});

router.post("/drive-thru/lpr", requireAnyAuth, (req, res) => {
  const restaurantId = (req as any).auth.companyId as string;
  const { rawPlate, source, provider, confidence } = req.body as {
    rawPlate?: string;
    source?: 'camera' | 'manual' | 'external';
    provider?: string;
    confidence?: number;
  };

  if (!rawPlate || !rawPlate.trim()) {
    res.status(400).json({ error: "rawPlate é obrigatório" });
    return;
  }

  const result = createDriveThruLprResult({
    restaurantId,
    source: source ?? 'external',
    provider,
    rawPlate,
    confidence,
  });

  const records = getRestaurantLprResults(restaurantId);
  records.push(result);
  res.status(201).json(result);
});

export default router;
