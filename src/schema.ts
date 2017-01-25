export interface CRMInfo {
    customer_id: string;
    activated_at: string;
    deactivated_at: string;
    fee_price: number;
}

export interface MeterInfo {
    meter_id: string;
    cylinder_id: string;
}

export interface CylinderInfo {
    cylinder_id: string;
}

export interface CRMState {
    credit: number;
    gas_price_per_kg: number;
    deposit_paid: boolean;
    deposit_paid_at: string;
    meter_id: string;
    cylinder_id: string;
    stove_id: string;
    table_id: string;
    meter_received_at: string;
    cylinder_received_at: string;
}

export interface MeterState {
    customer_id: string;
    cylinder_id: string;
}

export interface CylinderState {
    customer_id: string;
    meter_id: string;
}
