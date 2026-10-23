import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meetingsRouter from "./meetings";
import { requireAuth } from "../lib/require-auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth, meetingsRouter);

export default router;
