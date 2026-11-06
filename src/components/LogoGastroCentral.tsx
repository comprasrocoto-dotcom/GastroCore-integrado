/**
 * Marca de Gastro Central: un anillo con un "slice" en azul, como un plato
 * visto desde arriba o un gráfico de torta de food cost — conecta con el
 * concepto de costeo (porcentajes) que ya usa toda la app. Reemplaza al
 * cuadrado con las letras "GC" que se usaba antes en el header y en el
 * login (ver docs/arquitectura.md).
 *
 * Es un SVG vectorial (no una imagen), así que se ve nítido en cualquier
 * tamaño — desde el ícono de la pestaña del navegador (ver
 * src/app/icon.svg, que usa este mismo dibujo) hasta el logo grande del
 * login.
 */
export default function LogoGastroCentral({
  className = "h-8 w-8",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 256 256"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="256" height="256" rx="56.32" fill="#1E3A5F" />
      <path
        d="M 175.07 174.26 A 66.0 66.0 0 1 1 183.04 91.57"
        fill="none"
        stroke="#2563EB"
        strokeWidth="30"
        strokeLinecap="round"
      />
      <path
        d="M 178.19 85.14 A 66.0 66.0 0 0 1 169.09 179.65"
        fill="none"
        stroke="#C9D6E4"
        strokeWidth="30"
        strokeLinecap="round"
      />
    </svg>
  );
}
