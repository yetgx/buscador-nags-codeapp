import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  Cr169_makesService,
  Cr169_make_modelsService,
  Cr169_nags_glassesService,
  Cr169_nags_glass_cfgsService,
  Cr169_nags_glass_detsService,
  Cr169_nags_prefixesService,
  Cr169_vehsService,
  Cr169_veh_glassesService,
  Cr169_veh_modifiersService,
  Vv_nags_glass_intchgsService,
  Vv_nags_glass_notesService,
  Vv_notesService,
  Vv_pricesnagsclientsService,
} from './generated'

type GlassZoneKey = 'windshield' | 'roof' | 'back' | 'quarter' | 'door' | 'side'

type Vehicle = {
  id: string
  makeId: string
  make: string
  model: string
  modelId: string
  modelLabel: string
  modifier: string
  modifierId: string
  year: number
  body: string
}

type NagsGlass = {
  id: string
  pk: string
  prefix: string
  prefixId: string
  prefixName: string
  description: string
  colors: string[]
  accessories: string[]
  notes: string[]
  priceRows: PriceRow[]
  vehicleIds: string[]
  interchanges: string[]
  flags: string[]
}

type PriceRow = {
  client: string
  nags: string
  price: number
  from: string
  to: string
}

type LoadResult = {
  makes: Array<{ id: string; name: string }>
  vehicles: Vehicle[]
  nagsCatalog: NagsGlass[]
  counts: {
    makes: number
    models: number
    vehicles: number
    nags: number
    vehGlasses: number
  }
}

const glassZones: Array<{
  key: GlassZoneKey
  num: number
  label: string
  prefixes: string[]
  prefixNames: string[]
  description: string
}> = [
  { key: 'windshield', num: 1, label: 'Parabrisas', prefixes: ['FW', 'DL', 'FL'], prefixNames: ['Windshield', 'Flat Windshield'], description: 'Cristal frontal del vehiculo' },
  { key: 'roof', num: 2, label: 'Quemacocos', prefixes: ['DR'], prefixNames: ['Roof'], description: 'Cristal de techo' },
  { key: 'back', num: 3, label: 'Medallon', prefixes: ['FB'], prefixNames: ['Back Window'], description: 'Cristal trasero' },
  { key: 'quarter', num: 4, label: 'Aleta', prefixes: ['DQ', 'FV'], prefixNames: ['Quarter', 'Vent'], description: 'Cristal pequeno lateral' },
  { key: 'door', num: 5, label: 'Puerta', prefixes: ['FD'], prefixNames: ['Door'], description: 'Ventanilla de puerta' },
  { key: 'side', num: 6, label: 'Costado', prefixes: ['FS', 'DY'], prefixNames: ['Side', 'Slider'], description: 'Ventanilla fija lateral' },
]

const clean = (value: unknown) => String(value ?? '').trim()
const numberFrom = (value: unknown) => Number(clean(value)) || 0
const unique = <T,>(items: T[]) => [...new Set(items)].sort((a, b) => String(a).localeCompare(String(b), 'es'))

const readRows = <T,>(result: unknown): T[] => {
  const shaped = result as { data?: T[]; value?: T[]; records?: T[]; entities?: T[] }
  return shaped.data ?? shaped.value ?? shaped.records ?? shaped.entities ?? []
}

type PagedResult<T> = {
  data?: T[]
  skipToken?: string
}

type GetAllFn<T> = (options?: Record<string, unknown>) => Promise<PagedResult<T>>

async function readAllPages<T>(getAll: GetAllFn<T>, options: Record<string, unknown> = {}) {
  const rows: T[] = []
  let skipToken = ''

  do {
    const result = await getAll({
      ...options,
      maxPageSize: 5000,
      ...(skipToken ? { skipToken } : {}),
    })
    rows.push(...readRows<T>(result))
    skipToken = clean(result.skipToken)
  } while (skipToken)

  return rows
}

async function readPage<T>(getAll: GetAllFn<T>, options: Record<string, unknown> = {}) {
  try {
    const result = await getAll({
      ...options,
      maxPageSize: 5000,
    })
    return readRows<T>(result)
  } catch (error) {
    console.error('Dataverse page load failed.', error)
    return []
  }
}

function money(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value)
}

function guidCondition(field: string, id: string) {
  return `${field} eq ${id}`
}

function textCondition(field: string, value: string) {
  return `${field} eq '${value.replace(/'/g, "''")}'`
}

function orFilter(conditions: string[]) {
  return conditions.length ? conditions.map((item) => `(${item})`).join(' or ') : ''
}

async function readDataverse(): Promise<LoadResult> {
  const makesResult = await readAllPages<any>(Cr169_makesService.getAll, { orderBy: ['cr169_make_name asc'] })

  const [
    modelsResult,
    modifiersResult,
    prefixesResult,
    vehsResult,
    vehGlassResult,
    nagsResult,
    detsResult,
    cfgsResult,
    pricesResult,
    intchgsResult,
    notesLinksResult,
    notesResult,
  ] = await Promise.all([
    readPage<any>(Cr169_make_modelsService.getAll, { orderBy: ['cr169_make_model_name asc'] }),
    readPage<any>(Cr169_veh_modifiersService.getAll),
    readPage<any>(Cr169_nags_prefixesService.getAll),
    readPage<any>(Cr169_vehsService.getAll),
    readPage<any>(Cr169_veh_glassesService.getAll),
    readPage<any>(Cr169_nags_glassesService.getAll),
    readPage<any>(Cr169_nags_glass_detsService.getAll),
    readPage<any>(Cr169_nags_glass_cfgsService.getAll),
    readPage<any>(Vv_pricesnagsclientsService.getAll),
    readPage<any>(Vv_nags_glass_intchgsService.getAll),
    readPage<any>(Vv_nags_glass_notesService.getAll),
    readPage<any>(Vv_notesService.getAll),
  ])

  const makes = makesResult
  const models = modelsResult
  const modifiers = modifiersResult
  const prefixes = prefixesResult
  const vehs = vehsResult
  const vehGlasses = vehGlassResult
  const nagsRows = nagsResult
  const detRows = detsResult
  const cfgRows = cfgsResult
  const priceRows = pricesResult
  const intchgRows = intchgsResult
  const noteLinks = notesLinksResult
  const noteRows = notesResult

  const makeById = new Map(makes.map((row) => [clean(row.cr169_makeid), clean(row.cr169_make_name)]))
  const modifierById = new Map(modifiers.map((row) => [clean(row.cr169_veh_modifierid), clean(row.cr169_dsc)]))
  const prefixById = new Map(
    prefixes.map((row) => [
      clean(row.cr169_nags_prefixid),
      {
        name: clean(row.cr169_dsc),
        code: clean(row.cr169_prefix_cd),
      },
    ]),
  )
  const modelById = new Map(
    models.map((row) => [
      clean(row.cr169_make_modelid),
      {
        name: clean(row.cr169_make_model_name) || clean(row.cr169_name),
        makeId: clean(row._vv_make_id_value),
        make: makeById.get(clean(row._vv_make_id_value)) || clean(row.vv_make_idname),
      },
    ]),
  )

  const vehicles: Vehicle[] = vehs
    .map((row) => {
      const modelId = clean(row._vv_make_model_value)
      const modifierId = clean(row._vv_veh_modifier_value)
      const model = modelById.get(modelId)
      const modifier = modifierById.get(modifierId) || clean(row.vv_veh_modifiername)
      const modelName = clean(model?.name) || clean(row.vv_make_modelname) || clean(row.cr169_make_model_id) || 'Sin modelo'
      return {
        id: clean(row.cr169_vehid),
        makeId: clean(model?.makeId),
        make: clean(model?.make) || clean(row.vv_make_modelname).split(' ')[0] || 'Sin marca',
        model: modelName,
        modelId,
        modelLabel: modifier ? `${modelName} ${modifier}` : modelName,
        modifier,
        modifierId,
        year: numberFrom(row.cr169_model_yr),
        body: clean(row.vv_body_stylename) || clean(row.cr169_body_style_id) || 'Sin carroceria',
      }
    })
    .filter((row) => row.id)

  const vehicleIdsByNagsPk = new Map<string, string[]>()
  const vehicleIdsByNagsCode = new Map<string, string[]>()
  for (const row of vehGlasses) {
    const nagsPk = clean(row._vv_nags_glass_value)
    const nagsCode = clean(row.cr169_nags_glass_id)
    const vehId = clean(row._vv_veh_value) || clean(row.cr169_veh_id)
    if (nagsPk && vehId) vehicleIdsByNagsPk.set(nagsPk, [...(vehicleIdsByNagsPk.get(nagsPk) ?? []), vehId])
    if (nagsCode && vehId) vehicleIdsByNagsCode.set(nagsCode, [...(vehicleIdsByNagsCode.get(nagsCode) ?? []), vehId])
  }

  const notesById = new Map(noteRows.map((row) => [clean(row.vv_noteid), clean(row.vv_notetext || row.vv_noteidentifier)]))
  const notesByNags = new Map<string, string[]>()
  for (const row of noteLinks) {
    const key = clean(row._vv_nags_glass_value) || clean(row.vv_nags_glass_id)
    const text = notesById.get(clean(row._vv_note_value)) || clean(row.vv_notename)
    if (key && text) notesByNags.set(key, [...(notesByNags.get(key) ?? []), text])
  }

  const nagsCatalog: NagsGlass[] = nagsRows
    .map((row) => {
      const id = clean(row.cr169_nags_glass_id)
      const pk = clean(row.cr169_nags_glassid)
      const prefixId = clean(row._vv_prefix_cd_value)
      const prefixMeta = prefixById.get(prefixId)
      const flags = [
        clean(row.cr169_ant_flag).toUpperCase() === 'Y' && 'Antena',
        clean(row.cr169_encap_flag).toUpperCase() === 'Y' && 'Encap',
        clean(row.cr169_hds_up_disp_flag).toUpperCase() === 'Y' && 'HUD',
        clean(row.cr169_heated_flag).toUpperCase() === 'Y' && 'Heated',
        clean(row.cr169_slider_flag).toUpperCase() === 'Y' && 'Slider',
        clean(row.cr169_solar_flag).toUpperCase() === 'Y' && 'Solar',
      ].filter(Boolean) as string[]

      return {
        id,
        pk,
        prefix: prefixMeta?.code || id.slice(0, 2) || clean(row.vv_prefix_cdname),
        prefixId,
        prefixName: prefixMeta?.name || clean(row.vv_prefix_cdname),
        description: prefixMeta?.name || clean(row.vv_prefix_cdname) || clean(row.cr169_part_num) || 'Cristal NAGS',
        colors: unique(
          detRows
            .filter((det) => clean(det._vv_nags_glass_value) === pk || clean(det.cr169_nags_glass_id) === id)
            .map((det) => clean(det.vv_glass_colorname || det.cr169_glass_color_cd))
            .filter(Boolean),
        ),
        accessories: unique(
          cfgRows
            .filter((cfg) => clean(cfg._vv_nags_glass_value) === pk || clean(cfg.cr169_nags_glass_id) === id)
            .map((cfg) => clean(cfg.cr169_atchmnt_dsc || cfg.cr169_atchmnt_flag || cfg.cr169_clips_flag))
            .filter(Boolean),
        ),
        notes: notesByNags.get(pk) ?? notesByNags.get(id) ?? [],
        priceRows: priceRows
          .filter((price) => clean(price.vv_nags).startsWith(id))
          .map((price) => ({
            client: clean(price.vv_clientename) || clean(price.vv_ClienteName) || 'Cliente',
            nags: clean(price.vv_nags),
            price: numberFrom(price.vv_price),
            from: clean(price.vv_desde),
            to: clean(price.vv_hasta),
          })),
        vehicleIds: unique(vehicleIdsByNagsPk.get(pk) ?? vehicleIdsByNagsCode.get(id) ?? []),
        interchanges: unique(
          intchgRows
            .filter((item) => clean(item._vv_nags_glass_og_value) === pk || clean(item.vv_nagoriginal) === id)
            .map((item) => clean(item.vv_naginterchangable))
            .filter(Boolean),
        ),
        flags,
      }
    })
    .filter((row) => row.id)

  return {
    makes: makes
      .map((row) => ({ id: clean(row.cr169_makeid), name: clean(row.cr169_make_name) }))
      .filter((row) => row.id && row.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    vehicles,
    nagsCatalog,
    counts: {
      makes: makes.length,
      models: models.length,
      vehicles: vehicles.length,
      nags: nagsCatalog.length,
      vehGlasses: vehGlasses.length,
    },
  }
}

function buildNagsFromRow(row: any, vehicleIds: string[] = []): NagsGlass {
  const id = clean(row.cr169_nags_glass_id)
  const pk = clean(row.cr169_nags_glassid)
  return {
    id,
    pk,
    prefix: id.slice(0, 2) || clean(row.vv_prefix_cdname),
    prefixId: clean(row._vv_prefix_cd_value),
    prefixName: clean(row.vv_prefix_cdname),
    description: clean(row.vv_prefix_cdname) || clean(row.cr169_part_num) || 'Cristal NAGS',
    colors: [],
    accessories: [],
    notes: [],
    priceRows: [],
    vehicleIds,
    interchanges: [],
    flags: [
      clean(row.cr169_ant_flag).toUpperCase() === 'Y' && 'Antena',
      clean(row.cr169_encap_flag).toUpperCase() === 'Y' && 'Encap',
      clean(row.cr169_hds_up_disp_flag).toUpperCase() === 'Y' && 'HUD',
      clean(row.cr169_heated_flag).toUpperCase() === 'Y' && 'Heated',
      clean(row.cr169_slider_flag).toUpperCase() === 'Y' && 'Slider',
      clean(row.cr169_solar_flag).toUpperCase() === 'Y' && 'Solar',
    ].filter(Boolean) as string[],
  }
}

async function fetchVehicleGlassForVehicles(vehicleIds: string[]) {
  const rows: any[] = []
  for (let i = 0; i < vehicleIds.length; i += 20) {
    const chunk = vehicleIds.slice(i, i + 20)
    const filter = orFilter(chunk.map((id) => guidCondition('_vv_veh_value', id)))
    rows.push(...await readPage<any>(Cr169_veh_glassesService.getAll, { filter }))
  }
  return rows
}

async function fetchNagsByKeys(nagsPks: string[], nagsCodes: string[]) {
  const rows: any[] = []
  for (let i = 0; i < nagsPks.length; i += 20) {
    const chunk = nagsPks.slice(i, i + 20)
    const filter = orFilter(chunk.map((id) => guidCondition('cr169_nags_glassid', id)))
    rows.push(...await readPage<any>(Cr169_nags_glassesService.getAll, { filter }))
  }
  for (let i = 0; i < nagsCodes.length; i += 20) {
    const chunk = nagsCodes.slice(i, i + 20)
    const filter = orFilter(chunk.map((code) => textCondition('cr169_nags_glass_id', code)))
    rows.push(...await readPage<any>(Cr169_nags_glassesService.getAll, { filter }))
  }
  return rows
}

function App() {
  const [allMakes, setAllMakes] = useState<Array<{ id: string; name: string }>>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [nagsCatalog, setNagsCatalog] = useState<NagsGlass[]>([])
  const [searchResults, setSearchResults] = useState<NagsGlass[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [dataStatus, setDataStatus] = useState('Cargando Dataverse...')
  const [query, setQuery] = useState('')
  const [makeId, setMakeId] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [body, setBody] = useState('')
  const [activeZones, setActiveZones] = useState<GlassZoneKey[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [activeTab, setActiveTab] = useState('base')
  const [priceSort, setPriceSort] = useState<'none' | 'asc' | 'desc'>('none')

  useEffect(() => {
    let mounted = true
    readDataverse()
      .then((data) => {
        if (!mounted) return
        setAllMakes(data.makes)
        setVehicles(data.vehicles)
        setNagsCatalog(data.nagsCatalog)
        setDataStatus(
          `Dataverse: ${data.counts.nags} NAGS, ${data.counts.vehicles} vehiculos, ${data.counts.makes} marcas`,
        )
      })
      .catch((error: unknown) => {
        console.error('Dataverse load failed.', error)
        if (mounted) setDataStatus('Error cargando Dataverse')
      })

    return () => {
      mounted = false
    }
  }, [])

  const selected = [...searchResults, ...nagsCatalog].find((item) => item.id === selectedId) ?? null
  const selectedPrefixCodes = activeZones.flatMap((zone) => glassZones.find((item) => item.key === zone)?.prefixes ?? [])
  const selectedPrefixNames = activeZones.flatMap((zone) => glassZones.find((item) => item.key === zone)?.prefixNames ?? [])
  const selectedMakeName = allMakes.find((item) => item.id === makeId)?.name ?? ''
  const hasFilters = Boolean(query || makeId || model || year || body || activeZones.length)

  const makes = allMakes
  const models = unique(vehicles.filter((item) => !makeId || item.makeId === makeId).map((item) => item.modelLabel).filter(Boolean))
  const years = unique(
    vehicles
      .filter((item) => (!makeId || item.makeId === makeId) && (!model || item.modelLabel === model))
      .map((item) => item.year)
      .filter(Boolean),
  ).reverse()
  const bodies = unique(
    vehicles
      .filter((item) => (!makeId || item.makeId === makeId) && (!model || item.modelLabel === model))
      .map((item) => item.body)
      .filter(Boolean),
  )

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          (!makeId || vehicle.makeId === makeId) &&
          (!model || vehicle.modelLabel === model) &&
          (!year || vehicle.year === Number(year)) &&
          (!body || vehicle.body === body),
      ),
    [body, makeId, model, vehicles, year],
  )

  useEffect(() => {
    let mounted = true

    async function runVehicleSearch() {
      const q = query.trim().toUpperCase()
      const hasVehicleFilter = Boolean(makeId || model || year || body)
      const hasSearch = Boolean(hasVehicleFilter || activeZones.length || q)

      if (!hasSearch) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const selectedVehicleIds = filteredVehicles.map((item) => item.id).filter(Boolean)
        let nextResults: NagsGlass[] = []

        if (hasVehicleFilter && selectedVehicleIds.length) {
          const vgRows = await fetchVehicleGlassForVehicles(selectedVehicleIds)
          const vehicleIdsByPk = new Map<string, string[]>()
          const vehicleIdsByCode = new Map<string, string[]>()

          for (const row of vgRows) {
            const vehId = clean(row._vv_veh_value) || clean(row.cr169_veh_id)
            const pk = clean(row._vv_nags_glass_value)
            const code = clean(row.cr169_nags_glass_id)
            if (pk && vehId) vehicleIdsByPk.set(pk, [...(vehicleIdsByPk.get(pk) ?? []), vehId])
            if (code && vehId) vehicleIdsByCode.set(code, [...(vehicleIdsByCode.get(code) ?? []), vehId])
          }

          const nagsRows = await fetchNagsByKeys([...vehicleIdsByPk.keys()], [...vehicleIdsByCode.keys()])
          const byId = new Map<string, NagsGlass>()

          for (const row of nagsRows) {
            const item = buildNagsFromRow(row, vehicleIdsByPk.get(clean(row.cr169_nags_glassid)) ?? vehicleIdsByCode.get(clean(row.cr169_nags_glass_id)) ?? [])
            if (item.id) byId.set(item.id, item)
          }

          for (const [code, vehIds] of vehicleIdsByCode.entries()) {
            if (!byId.has(code)) {
              byId.set(code, {
                id: code,
                pk: '',
                prefix: code.slice(0, 2),
                prefixId: '',
                prefixName: '',
                description: 'Cristal NAGS',
                colors: [],
                accessories: [],
                notes: [],
                priceRows: [],
                vehicleIds: unique(vehIds),
                interchanges: [],
                flags: [],
              })
            }
          }

          nextResults = [...byId.values()]
        } else {
          nextResults = nagsCatalog
        }

        if (mounted) setSearchResults(nextResults)
      } finally {
        if (mounted) setIsSearching(false)
      }
    }

    runVehicleSearch()

    return () => {
      mounted = false
    }
  }, [activeZones.length, body, filteredVehicles, makeId, model, nagsCatalog, query, year])

  const results = useMemo(() => {
    const q = query.trim().toUpperCase()
    const vehicleIds = new Set(filteredVehicles.map((item) => item.id))
    const source = searchResults.length ? searchResults : nagsCatalog

    return source.filter((nags) => {
      const relatedVehicles = vehicles.filter((item) => nags.vehicleIds.includes(item.id))
      const vehicleText = relatedVehicles.map((item) => `${item.make} ${item.model} ${item.year} ${item.body}`).join(' ').toUpperCase()
      const hasVehicleFilter = Boolean(makeId || model || year || body)
      const matchesVehicle = !hasVehicleFilter || nags.vehicleIds.some((id) => vehicleIds.has(id))
      const prefixName = nags.prefixName.toLowerCase()
      const matchesZone =
        selectedPrefixNames.length === 0 ||
        selectedPrefixNames.some((name) => prefixName === name.toLowerCase()) ||
        selectedPrefixCodes.includes(nags.prefix)
      const matchesText = !q || nags.id.includes(q) || nags.description.toUpperCase().includes(q) || vehicleText.includes(q)
      return matchesVehicle && matchesZone && matchesText
    })
  }, [filteredVehicles, makeId, model, nagsCatalog, query, searchResults, selectedPrefixCodes, selectedPrefixNames, vehicles, year, body])

  const selectedVehicles = selected ? vehicles.filter((vehicle) => selected.vehicleIds.includes(vehicle.id)) : []
  const selectedPrices = [...(selected?.priceRows ?? [])].sort((a, b) => {
    if (priceSort === 'asc') return a.price - b.price
    if (priceSort === 'desc') return b.price - a.price
    return 0
  })

  function clearFilters() {
    setMakeId('')
    setModel('')
    setYear('')
    setBody('')
    setActiveZones([])
    setSelectedId('')
  }

  function clearAll() {
    setQuery('')
    clearFilters()
    setActiveTab('base')
  }

  function toggleZone(zone: GlassZoneKey) {
    setActiveZones((current) => (current.includes(zone) ? current.filter((item) => item !== zone) : [...current, zone]))
  }

  const chips = [
    makeId && { label: `Marca: ${selectedMakeName}`, onClear: () => setMakeId('') },
    model && { label: `Modelo: ${model}`, onClear: () => setModel('') },
    year && { label: `Anio: ${year}`, onClear: () => setYear('') },
    body && { label: `Carroceria: ${body}`, onClear: () => setBody('') },
    query && { label: `Busqueda: ${query}`, onClear: () => setQuery('') },
    activeZones.length > 0 && { label: `Cristal: ${activeZones.length}`, onClear: () => setActiveZones([]) },
  ].filter(Boolean) as Array<{ label: string; onClear: () => void }>

  return (
    <div className="appShell">
      <header className="hero">
        <div>
          <span className="eyebrow">Code App</span>
          <h1>Buscador de NAGS</h1>
          <p>Consulta cristales por vehiculo, codigo NAGS, tipo de cristal, precios e intercambiables.</p>
          <span className="dataStatus">{dataStatus}</span>
        </div>
        <div className="searchPanel glass">
          <label className="srOnly" htmlFor="search">Buscar</label>
          <input id="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por NAGS, marca o modelo" />
          <button className="primaryButton" type="button">Buscar</button>
          <button className="ghostButton" type="button" onClick={clearAll}>Limpiar todo</button>
        </div>
      </header>

      {chips.length > 0 && (
        <div className="chips" aria-label="Filtros activos">
          {chips.map((chip) => (
            <button key={chip.label} type="button" onClick={chip.onClear}>
              {chip.label}
              <span aria-hidden="true">x</span>
            </button>
          ))}
        </div>
      )}

      <main className="mainGrid">
        <section className="leftRail glass">
          <div className="sectionTitle">
            <h2>Filtros</h2>
            <div className="sectionActions">
              <span>{isSearching ? 'Buscando...' : `${results.length} NAGS`}</span>
              <button type="button" onClick={clearFilters} disabled={!hasFilters}>Limpiar filtros</button>
            </div>
          </div>

          <div className="filters">
            <Field label="Marca" value={makeId} onChange={(value) => { setMakeId(value); setModel(''); setYear(''); setBody('') }} options={makes.map((item) => ({ value: item.id, label: item.name }))} placeholder="Todas" />
            <Field label="Modelo" value={model} onChange={(value) => { setModel(value); setYear(''); setBody('') }} options={models} placeholder="Todos" />
            <Field label="Anio" value={year} onChange={setYear} options={years.map(String)} placeholder="Todos" />
            <Field label="Carroceria" value={body} onChange={setBody} options={bodies} placeholder="Todas" />
          </div>

          <div className="glassPicker">
            <div className="glassPickerHead">
              <div className="fieldLabel">Tipo de cristal</div>
              <button type="button" onClick={() => setActiveZones([])} disabled={activeZones.length === 0}>Quitar tipo</button>
            </div>
            <CarGlass activeZones={activeZones} onToggle={toggleZone} />
            {activeZones.length > 0 && (
              <div className="zoneLegend">
                {glassZones
                  .filter((zone) => activeZones.includes(zone.key))
                  .map((zone) => (
                    <div key={zone.key}>
                      <b>{zone.num}. {zone.label}</b>
                      <span>{zone.description} ({zone.prefixes.join(', ')})</span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="results">
            {results.length === 0 ? (
              <div className="empty">{nagsCatalog.length === 0 ? 'No hay NAGS cargados desde Dataverse.' : 'No hay resultados con los filtros actuales.'}</div>
            ) : (
              results.map((nags) => {
                const related = vehicles.filter((vehicle) => nags.vehicleIds.includes(vehicle.id))
                return (
                  <button
                    className={`resultCard ${selectedId === nags.id ? 'active' : ''}`}
                    key={nags.pk || nags.id}
                    type="button"
                    onClick={() => { setSelectedId(nags.id); setActiveTab('base') }}
                  >
                    <span>
                      <strong>{nags.id}</strong>
                      <small>{related.map((vehicle) => `${vehicle.make} ${vehicle.modelLabel}`).join(' | ') || nags.description}</small>
                    </span>
                    <em>{nags.prefix}</em>
                  </button>
                )
              })
            )}
          </div>
        </section>

        <aside className="detailPane glass">
          {!selected ? (
            <div className="empty detailEmpty">Selecciona un NAGS para ver el detalle.</div>
          ) : (
            <>
              <div className="detailHeader">
                <div>
                  <span className="eyebrow">{selected.prefix}</span>
                  <h2>{selected.id}</h2>
                  <p>{selected.description}</p>
                </div>
                <div className="flagStack">
                  {selected.flags.map((flag) => <span key={flag}>{flag}</span>)}
                </div>
              </div>

              <div className="tabs" role="tablist">
                {[
                  ['base', 'Base'],
                  ['colors', 'Colores'],
                  ['acc', 'Accesorios'],
                  ['prices', 'Precios'],
                  ['vehicles', 'Vehiculos'],
                  ['intchgs', 'Intercambiables'],
                ].map(([key, label]) => (
                  <button className={activeTab === key ? 'active' : ''} key={key} type="button" onClick={() => setActiveTab(key)}>
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === 'base' && (
                <div className="infoGrid">
                  <Info label="NAGS" value={selected.id} />
                  <Info label="Tipo" value={selected.prefixName || selected.prefix} />
                  <Info label="Aplicaciones" value={`${selectedVehicles.length} vehiculos`} />
                  <Info label="Notas" value={selected.notes.join(' | ') || 'Sin notas registradas'} wide />
                </div>
              )}

              {activeTab === 'colors' && <PillList items={selected.colors} empty="Sin colores registrados." />}
              {activeTab === 'acc' && <PillList items={selected.accessories} empty="Sin accesorios registrados." />}

              {activeTab === 'prices' && (
                <div className="tablePane">
                  <button className="ghostButton sortButton" type="button" onClick={() => setPriceSort(priceSort === 'none' ? 'asc' : priceSort === 'asc' ? 'desc' : 'none')}>
                    Precio {priceSort === 'asc' ? 'up' : priceSort === 'desc' ? 'down' : 'sort'}
                  </button>
                  {selectedPrices.length === 0 ? <div className="empty">Sin precios registrados.</div> : selectedPrices.map((row) => (
                    <div className="priceRow" key={`${row.client}-${row.nags}`}>
                      <strong>{money(row.price)}</strong>
                      <span>{row.client}</span>
                      <small>{row.nags} | {row.from} a {row.to}</small>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'vehicles' && (
                <div className="vehicleList">
                  {selectedVehicles.length === 0 ? <div className="empty">Sin vehiculos relacionados.</div> : selectedVehicles.map((vehicle) => (
                    <div key={vehicle.id}>
                      <strong>{vehicle.make} {vehicle.modelLabel}</strong>
                      <span>{vehicle.year || 'Sin anio'} | {vehicle.body}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'intchgs' && <PillList items={selected.interchanges} empty="Sin intercambiables registrados." />}
            </>
          )}
        </aside>
      </main>
    </div>
  )
}

type FieldOption = string | { value: string; label: string }

function Field({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (value: string) => void; options: FieldOption[]; placeholder: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value
          const label = typeof option === 'string' ? option : option.label
          return <option key={value} value={value}>{label}</option>
        })}
      </select>
    </label>
  )
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`infoCard ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PillList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <div className="empty">{empty}</div>
  return <div className="pillList">{items.map((item) => <span key={item}>{item}</span>)}</div>
}

function CarGlass({ activeZones, onToggle }: { activeZones: GlassZoneKey[]; onToggle: (zone: GlassZoneKey) => void }) {
  const active = (zone: GlassZoneKey) => (activeZones.includes(zone) ? 'carZone active' : 'carZone')

  return (
    <svg className="carSvg" viewBox="-80 0 460 420" xmlns="http://www.w3.org/2000/svg" aria-label="Filtro por tipo de cristal">
      <path d="M 170,18 C 148,18 132,24 124,34 L 112,58 C 108,66 106,74 106,82 L 106,108 L 234,108 L 234,82 C 234,74 232,66 228,58 L 216,34 C 208,24 192,18 170,18 Z" className="carBody" />
      <rect x="116" y="168" width="108" height="74" rx="6" className="carBody" />
      <path d="M 106,268 L 106,298 C 106,310 110,320 118,328 L 128,340 C 136,350 152,356 170,356 C 188,356 204,350 212,340 L 222,328 C 230,320 234,310 234,298 L 234,268 Z" className="carBody" />
      <rect x="96" y="108" width="12" height="160" rx="4" className="carBody side" />
      <rect x="232" y="108" width="12" height="160" rx="4" className="carBody side" />
      <polygon className={active('windshield')} onClick={() => onToggle('windshield')} points="128,60 212,60 222,104 118,104" />
      <polygon className={active('quarter')} onClick={() => onToggle('quarter')} points="104,72 118,78 116,104 102,98" />
      <polygon className={active('quarter')} onClick={() => onToggle('quarter')} points="236,72 222,78 224,104 238,98" />
      <rect className={active('roof')} onClick={() => onToggle('roof')} x="138" y="172" width="64" height="66" rx="4" />
      <rect className={active('door')} onClick={() => onToggle('door')} x="96" y="112" width="14" height="76" rx="3" />
      <rect className={active('door')} onClick={() => onToggle('door')} x="230" y="112" width="14" height="76" rx="3" />
      <rect className={active('side')} onClick={() => onToggle('side')} x="96" y="192" width="14" height="66" rx="3" />
      <rect className={active('side')} onClick={() => onToggle('side')} x="230" y="192" width="14" height="66" rx="3" />
      <polygon className={active('back')} onClick={() => onToggle('back')} points="122,268 218,268 212,304 128,304" />
      {glassZones.map((zone, index) => (
        <text key={zone.key} x={index < 3 ? 68 : 274} y={62 + (index % 3) * 80} textAnchor={index < 3 ? 'end' : 'start'} className="carLabel">
          {zone.num}. {zone.label}
          <tspan x={index < 3 ? 68 : 274} dy="18">{zone.prefixes.join(', ')}</tspan>
        </text>
      ))}
    </svg>
  )
}

export default App
