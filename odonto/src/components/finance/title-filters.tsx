// Hello World
export function TitleFilters({ status, from, to, q }: { status: string; from?: string; to?: string; q?: string }) {
  return (
    <form className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-border bg-white px-4 py-3 sm:grid-cols-5 sm:items-end sm:px-5" role="search">
      <div>
        <label htmlFor="status" className="mb-1.5 block text-sm font-medium">
          Situação
        </label>
        <select id="status" name="status" defaultValue={status} className="h-10 w-full rounded-md border border-border-strong px-2 text-sm">
          <option value="open_all">Em aberto</option>
          <option value="overdue">Vencidos</option>
          <option value="paid">Quitados</option>
          <option value="cancelled">Cancelados</option>
          <option value="all">Todos</option>
        </select>
      </div>
      <div>
        <label htmlFor="from" className="mb-1.5 block text-sm font-medium">
          Vencimento de
        </label>
        <input id="from" name="from" type="date" defaultValue={from} className="h-10 w-full rounded-md border border-border-strong px-2 text-sm" />
      </div>
      <div>
        <label htmlFor="to" className="mb-1.5 block text-sm font-medium">
          Até
        </label>
        <input id="to" name="to" type="date" defaultValue={to} className="h-10 w-full rounded-md border border-border-strong px-2 text-sm" />
      </div>
      <div>
        <label htmlFor="q" className="mb-1.5 block text-sm font-medium">
          Buscar
        </label>
        <input id="q" name="q" defaultValue={q} className="h-10 w-full rounded-md border border-border-strong px-3 text-sm" />
      </div>
      <button type="submit" className="h-10 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-surface-2 cursor-pointer">
        Filtrar
      </button>
    </form>
  );
}
