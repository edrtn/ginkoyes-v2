"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StockRow {
  TAILLE: string | null;
  COULEUR: string | null;
  QTE: number;
  PRIX_ACHAT: number | null;
}

interface StockTableProps {
  data: StockRow[];
}

export default function StockTable({ data }: StockTableProps) {
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-gray-500">Aucune donnée de stock disponible.</p>
    );
  }

  const totalQte = data.reduce((sum, r) => sum + (r.QTE || 0), 0);
  const totalValor = data.reduce(
    (sum, r) => sum + (r.QTE || 0) * (r.PRIX_ACHAT || 0),
    0
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Couleur</TableHead>
            <TableHead>Taille</TableHead>
            <TableHead className="text-right">Qté</TableHead>
            <TableHead className="text-right">PUMP</TableHead>
            <TableHead className="text-right">Valorisation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i}>
              <TableCell>{row.COULEUR || "-"}</TableCell>
              <TableCell>{row.TAILLE || "-"}</TableCell>
              <TableCell className="text-right font-medium">{row.QTE}</TableCell>
              <TableCell className="text-right">
                {row.PRIX_ACHAT != null ? `${row.PRIX_ACHAT.toFixed(2)} €` : "-"}
              </TableCell>
              <TableCell className="text-right">
                {row.PRIX_ACHAT != null
                  ? `${(row.QTE * row.PRIX_ACHAT).toFixed(2)} €`
                  : "-"}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-gray-50 font-bold">
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell className="text-right">{totalQte}</TableCell>
            <TableCell />
            <TableCell className="text-right">
              {totalValor.toFixed(2)} €
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
