"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";

const COLORS = [
  "#8b5cf6", "#0ea5e9", "#f43f5e", "#f59e0b", "#14b8a6", "#6366f1", "#ec4899", "#84cc16",
];

function formatK(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M€`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k€`;
  return `${v.toFixed(0)}€`;
}

function formatEuro(v: number) {
  return Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €";
}

const glassTooltipStyle = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.5)",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
  background: "rgba(255,255,255,0.85)",
  backdropFilter: "blur(12px)",
};

interface BarChartProps {
  data: { name: string; value: number }[];
  color?: string;
}

export function SimpleBarChart({ data, color = "#8b5cf6" }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tickFormatter={formatK} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value) => formatEuro(Number(value))}
          contentStyle={glassTooltipStyle}
        />
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity={0.8} />
            <stop offset="100%" stopColor={color} stopOpacity={1} />
          </linearGradient>
        </defs>
        <Bar dataKey="value" fill="url(#barGradient)" radius={[0, 6, 6, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface PieChartProps {
  data: { name: string; value: number }[];
}

export function SimplePieChart({ data }: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={110}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatEuro(Number(value))}
          contentStyle={glassTooltipStyle}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface AreaChartProps {
  data: { name: string; value: number }[];
}

export function SimpleAreaChart({ data }: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatK} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value) => formatEuro(Number(value))}
          contentStyle={glassTooltipStyle}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#8b5cf6"
          strokeWidth={2.5}
          fill="url(#areaGradient)"
          dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }}
          activeDot={{ r: 6, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
