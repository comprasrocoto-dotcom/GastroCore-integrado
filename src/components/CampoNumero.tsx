"use client";
import { useEffect, useRef, useState } from "react";

/**
 * CampoNumero — igual que en GastroCore: sin flechitas de spinner, formato
 * colombiano en vivo (miles con punto, decimales con coma) mientras se
 * escribe, y siempre emite un number limpio por onCambio.
 */
export function CampoNumero({
  valor,
  onCambio,
  decimales = 2,
  sufijo,
  className = "",
  inputRef,
  placeholder,
}: {
  valor: number;
  onCambio: (n: number) => void;
  decimales?: number;
  sufijo?: string;
  className?: string;
  inputRef?: (el: HTMLInputElement | null) => void;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState<string>(() => formatear(valor, decimales));
  const editando = useRef(false);

  function formatear(n: number, dec: number): string {
    if (!isFinite(n)) return "";
    if (n === 0) return "0";
    const partes = Math.abs(n).toFixed(dec).split(".");
    const entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const deci = (partes[1] || "").replace(/0+$/, "");
    return (n < 0 ? "-" : "") + entero + (deci ? "," + deci : "");
  }

  function parsear(t: string): number {
    const limpio = t.replace(/\./g, "").replace(",", ".");
    const n = Number(limpio);
    return isFinite(n) ? n : 0;
  }

  useEffect(() => {
    if (!editando.current && parsear(texto) !== valor) {
      setTexto(formatear(valor, decimales));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  function alEscribir(e: React.ChangeEvent<HTMLInputElement>) {
    let crudo = e.target.value.replace(/[^\d,.-]/g, "");
    crudo = crudo.replace(/\./g, "");
    const neg = crudo.startsWith("-");
    crudo = crudo.replace(/-/g, "");
    const iComa = crudo.indexOf(",");
    let entero = iComa === -1 ? crudo : crudo.slice(0, iComa);
    const deci = iComa === -1 ? "" : crudo.slice(iComa + 1).replace(/,/g, "").slice(0, decimales);
    entero = entero.replace(/^0+(?=\d)/, "");
    const enteroFmt = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const mostrado = (neg ? "-" : "") + (enteroFmt || (iComa !== -1 ? "0" : "")) + (iComa !== -1 ? "," + deci : "");
    setTexto(mostrado);
    onCambio(parsear(mostrado));
  }

  return (
    <span className="relative inline-flex w-full">
      <input
        ref={(el) => {
          if (inputRef) inputRef(el);
        }}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={texto}
        placeholder={placeholder}
        onFocus={() => {
          editando.current = true;
        }}
        onBlur={() => {
          editando.current = false;
          setTexto(formatear(parsear(texto), decimales));
        }}
        onChange={alEscribir}
        className={className + (sufijo ? " !pr-6" : "")}
      />
      {sufijo && (
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs font-medium text-slate-400">
          {sufijo}
        </span>
      )}
    </span>
  );
}
