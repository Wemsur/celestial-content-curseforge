/**
 * The CurseForge content source.
 *
 * CurseForge has a real REST API (`api.curseforge.com/v1`), gated by an
 * `x-api-key` header. The key is compiled into this file — fill in `API_KEY`
 * below — and the launcher's network proxy forwards the header unimpeded; only
 * hop-by-hop headers are forbidden there.
 *
 * Content types map to CurseForge "classes": its top-level sections. The
 * numbers below are the API's stable class IDs for Minecraft (gameId 432).
 * Data packs are the odd one out: they live under Customization (4545) as one
 * category, so that search pins the category as well as the class.
 */

import type {
	ContentCard,
	ContentFilterGroup,
	ContentModpackPlan,
	ContentPage,
	ContentProject,
	ContentQuery,
	ContentSourceApi,
	ContentVersion,
	DownloadDescriptor,
	UpdateQueryItem,
	UpdateResult,
} from '@celestial/content-source'

const API_KEY = '$2a$10$/0oip8jXywEuF2E09UAcYulcgKAsp6sia3KWduVAFlM8Pz/RCqFvy'

const API_BASE = 'https://api.curseforge.com'
/** The MCIM community mirror proxies the CurseForge API verbatim, with a
 * `/curseforge` prefix. It needs no key — one is sent anyway, harmlessly. */
const MIRROR_BASE = 'https://mod.mcimirror.top'
const GAME_ID = 432

/** CurseForge class IDs for Minecraft's top-level sections. */
const CLASS_IDS: Partial<Record<string, number>> = {
	mod: 6,
	resourcepack: 12,
	shader: 6552,
	modpack: 4471,
	datapack: 4545,
}

/** Data packs are one category of the Customization class. */
const DATAPACK_CATEGORY_ID = 4780

/**
 * CurseForge's loader names in the launcher's spelling, which is also what the
 * version table's Platform filter matches on.
 */
const LOADER_NAMES: Record<string, string> = {
	forge: 'forge',
	neoforge: 'neoforge',
	fabric: 'fabric',
	quilt: 'quilt',
	liteloader: 'liteloader',
	rift: 'rift',
}

interface CfCategory {
	id: number
	name: string
	classId: number | null
	parentCategoryId?: number
}

interface CfFile {
	id: number
	/** The project this file belongs to; the batched files endpoint returns it. */
	modId: number
	displayName: string
	fileName: string
	fileDate: string
	releaseType: number
	fileLength: number
	downloadUrl: string | null
	hashes: { sha1?: string; sha512?: string }
	gameVersions: string[]
}

interface CfMod {
	id: number
	/** The class (top-level section) this project belongs to, when known. */
	classId?: number
	name: string
	summary: string
	logo?: { url?: string; thumbnailUrl?: string } | null
	downloadCount: number
	dateCreated: string
	dateModified: string
	authors?: { name: string }[]
	links?: { websiteUrl?: string | null } | null
	categories?: { id: number; name: string }[]
}

interface CfSearchPage {
	data: CfMod[]
	total: number
}

interface CfManifest {
	manifestType?: string
	manifestVersion?: number
	name?: string
	version?: string
	author?: string
	overrides?: string
	minecraft: {
		version: string
		modLoaders?: { id: string; primary?: boolean }[]
	}
	files: { projectID: number; fileID: number; required?: boolean }[]
}

const CATEGORY_ZH: Record<string, string> = {
	'Adventure and RPG': '冒险与角色扮演',
	'API and Library': 'API 与类库',
	'Armor, Tools, and Weapons': '盔甲、工具与武器',
	'Automation': '自动化',
	'Biomes': '生物群系',
	'Buildcraft': '建筑工艺',
	'Cosmetic': '装饰',
	'Education': '教育',
	'Energy': '能源',
	'Energy, Fluid, and Item Transport': '能源、流体与物品运输',
	'Farming': '农业',
	'Food': '食物',
	'Forestry': '林业',
	'Genetics': '基因',
	'Industrial Craft': '工业工艺',
	'Integration': '联动',
	'Magic': '魔法',
	'Map and Information': '地图与信息',
	'MCreator': 'MCreator',
	'Miscellaneous': '杂项',
	'Mobs': '生物',
	'Performance': '性能优化',
	'Player Transport': '玩家运输',
	'Redstone': '红石',
	'Server Utility': '服务器工具',
	'Storage': '存储',
	'Structures': '结构',
	'Technology': '科技',
	'Thermal Expansion': '热力膨胀',
	'Twitch Integration': 'Twitch 联动',
	'Utility & QoL': '实用工具与体验优化',
	'World Gen': '世界生成',
	'Exploration': '探索',
	'Extra Large': '超大型',
	'FTB Official Pack': 'FTB 官方整合包',
	'Hardcore': '硬核',
	'Mini Game': '小游戏',
	'Multiplayer': '多人游戏',
	'Quests': '任务',
	'Sci-Fi': '科幻',
	'Skyblock': '空岛',
	'Small / Light': '小型与轻量',
	'Combat / PvP': '战斗与 PvP',
	'Modern': '现代',
	'Medieval': '中世纪',
	'Steampunk': '蒸汽朋克',
	'Traditional': '传统',
	'Animated': '动画',
	'Photo Realistic': '照片级写实',
	'16x': '16x',
	'32x': '32x',
	'64x': '64x',
	'128x': '128x',
	'256x': '256x',
	'512x and Higher': '512x 及以上',
	'Data Packs': '数据包',
	'Configuration': '配置',
	'Lucky Blocks': '幸运方块',
	'Guidebook': '指南',
	'FancyMenu': 'FancyMenu',
	'Vanilla': '原版',
	'Realistic': '写实',
	'Fantasy': '奇幻',
	'Low End': '低配置',
	'High End': '高配置',
	'Lagless': '低性能开销',
	'All': '全部',
}

export async function activate(api: ContentSourceApi) {
	function categoryLabel(name: string): string {
		return api.i18n.locale.toLowerCase().startsWith('zh') ? CATEGORY_ZH[name] ?? name : name
	}

	/**
	 * The key the requests carry: the one the user typed over the settings
	 * form, else the one compiled in. A missing key is not an error until a
	 * request is actually made — the source still lists its settings.
	 */
	async function apiKey(): Promise<string> {
		const override = await api.settings.get('apiKey')
		const key = (override && override.trim()) || API_KEY.trim()
		if (!key) {
			throw new Error('未配置 CurseForge API Key。请在内容源设置里填写，或在插件编译前填入 src/index.ts 的 API_KEY。')
		}
		return key
	}

	async function request(
		path: string,
		init?: { method?: string; body?: string; mirror?: boolean },
	): Promise<import('@celestial/content-source').SourceFetchResult> {
		const key = await apiKey()
		const url = init?.mirror ? `${MIRROR_BASE}${path}` : `${API_BASE}${path}`
		api.log(`请求 ${url}（key 长度 ${key.length}，开头 ${key.slice(0, 6)}…）`)
		const response = await api.net.fetch(url, {
			method: init?.method,
			headers: {
				accept: 'application/json',
				...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
				'x-api-key': key,
			},
			body: init?.body,
		})
		if (response.status === 403 || response.status === 401) {
			let detail = response.body.slice(0, 300)
			try {
				const parsed = JSON.parse(response.body) as {
					error?: string
					description?: string
					message?: string
				}
				detail = parsed.description ?? parsed.error ?? parsed.message ?? detail
			} catch {
				// 非 JSON 响应体（例如 Cloudflare 拦截页）原样截断展示
			}
			throw new Error(
				`CurseForge 拒绝了请求（${response.status}）。已发送长度 ${key.length} 的 Key。响应：${detail || '(空)'}`,
			)
		}
		if (!response.ok) {
			throw new Error(`CurseForge ${response.status} ${path}`)
		}
		return response
	}

	async function get<T>(path: string): Promise<T> {
		try {
			return JSON.parse((await request(path)).body) as T
		} catch (error) {
			api.log(`官方接口失败，改走 MCIM 镜像：${path}：${String(error)}`)
			return JSON.parse((await request(`/curseforge${path}`, { mirror: true })).body) as T
		}
	}

	/** The launcher's sort keys mapped onto CurseForge's numeric sort fields. */
	function sortField(sort: ContentQuery['sort']): string | undefined {
		if (sort === 'downloads') return '6' // TotalDownloads
		if (sort === 'newest') return '1' // DateCreated
		if (sort === 'updated') return '3' // LastUpdated
		if (sort === 'follows') return '2' // Popularity, the closest it has
		return undefined // relevance: the API's own default
	}

	/** The category tick of the 类别 group, as CurseForge category IDs. */
	function selectedCategories(request: ContentQuery): string[] {
		const groups = request.filters as Record<string, string[]> | undefined
		return groups?.category ?? []
	}

	async function search(request: ContentQuery): Promise<ContentPage> {
		const classId = CLASS_IDS[request.contentType]
		if (!classId) return { items: [], total: 0 }

		const pageSize = request.limit || 20
		const params = new URLSearchParams({
			gameId: String(GAME_ID),
			classId: String(classId),
			index: String(Math.max(0, (request.page - 1) * pageSize)),
			pageSize: String(pageSize),
		})
		if (request.query?.trim()) params.set('searchFilter', request.query.trim())
		const sort = request.sort === 'relevance' && !request.query?.trim()
			? '2'
			: sortField(request.sort)
		if (sort) {
			params.set('sortField', sort)
			params.set('sortOrder', 'desc')
		}
		const categories = new Set(selectedCategories(request))
		if (request.contentType === 'datapack') categories.add(String(DATAPACK_CATEGORY_ID))
		for (const category of categories) {
			params.append('categoryIds', category)
		}
		if (request.gameVersion) {
			params.set('gameVersion', request.gameVersion)
		}
		if (request.loader && request.contentType === 'mod') {
			params.set('modLoaderType', modLoaderType(request.loader))
		}

		const page = await get<CfSearchPage>(`/v1/mods/search?${params.toString()}`)
		const items = (page.data ?? []).map((mod) => toCard(mod, request.contentType))
		return { items, total: page.total ?? items.length }
	}

	/** The launcher's loader names in CurseForge's enum. */
	function modLoaderType(loader: string): string {
		if (loader === 'forge') return '1'
		if (loader === 'neoforge') return '6'
		if (loader === 'quilt') return '5'
		if (loader === 'fabric') return '4'
		return '0'
	}

	/** Where a project of a given class installs, in the instance. */
	function classFolder(classId: number | undefined): string {
		if (classId === 12) return 'resourcepacks'
		if (classId === 6552) return 'shaderpacks'
		return 'mods'
	}

	function toCard(mod: CfMod, contentType: string): ContentCard {
		return {
			sourceId: api.source.id,
			id: String(mod.id),
			contentType: contentType as ContentCard['contentType'],
			name: mod.name,
			summary: mod.summary || undefined,
			iconUrl: mod.logo?.url ?? mod.logo?.thumbnailUrl ?? undefined,
			author: mod.authors?.[0]?.name,
			downloads: mod.downloadCount,
			publishedAt: mod.dateCreated,
			updatedAt: mod.dateModified,
			tags: (mod.categories ?? []).map((category) => categoryLabel(category.name)).slice(0, 6),
		}
	}

	/**
	 * A file's `gameVersions` mixes three kinds of entry: game versions, loader
	 * names, and things the launcher has no column for ("Java 21", "Client",
	 * "Server"). Split them — a version-looking string is a game version, a known
	 * loader name is a loader, and the rest is dropped rather than filed under a
	 * heading that means something else.
	 */
	function splitGameVersions(values: string[] | undefined): {
		gameVersions: string[]
		loaders: string[]
	} {
		const gameVersions: string[] = []
		const loaders: string[] = []
		for (const value of values ?? []) {
			const loader = LOADER_NAMES[value.trim().toLowerCase()]
			if (loader) {
				if (!loaders.includes(loader)) loaders.push(loader)
			} else if (/^\d/.test(value.trim()) && !gameVersions.includes(value)) {
				gameVersions.push(value)
			}
		}
		return { gameVersions, loaders }
	}

	/**
	 * The readable part of a file's name.
	 *
	 * CurseForge authors write `displayName` as "<version> for <loader> <game
	 * version>" — "31.10.0.63 for NeoForge 26.3". Everything after " for " is
	 * already shown in the table's own Platform and Game version columns, so the
	 * version cell wants only the head. The numeric file id is *not* a version
	 * number; it is only an id, and showing it made every row read as a serial.
	 */
	function versionLabel(file: CfFile): string {
		const head = (file.displayName ?? '').split(/\s+for\s+/i)[0]?.trim()
		return head || String(file.id)
	}

	function toVersion(file: CfFile, projectUrl?: string | null): ContentVersion {
		const { gameVersions, loaders } = splitGameVersions(file.gameVersions)
		return {
			id: String(file.id),
			name: file.displayName,
			versionNumber: versionLabel(file),
			publishedAt: file.fileDate,
			channel: file.releaseType === 2 ? 'beta' : file.releaseType === 3 ? 'alpha' : 'release',
			gameVersions,
			loaders,
			// A file has no page of its own in the API; the site builds one under
			// the project's URL.
			url: projectUrl ? `${projectUrl.replace(/\/+$/, '')}/files/${file.id}` : undefined,
			files: [
				{
					id: String(file.id),
					name: file.fileName,
					size: file.fileLength || undefined,
				},
			],
		}
	}

	/**
	 * A project's numeric id, resolving a slug when that is what was given.
	 *
	 * CurseForge's file and detail endpoints only take the numeric mod id, but a
	 * project is also addressable by its slug — which is what a site that merely
	 * *links* to a CurseForge page knows it by (mcmod names a pack's CurseForge
	 * slug, not its id). So a non-numeric id is looked up once and the numeric id
	 * cached for the session.
	 */
	const modIdCache = new Map<string, number>()

	async function resolveModId(id: string): Promise<string> {
		if (/^\d+$/.test(id)) return id
		const cached = modIdCache.get(id)
		if (cached !== undefined) return String(cached)
		const payload = await get<{ data: CfMod[] }>(
			`/v1/mods/search?gameId=${GAME_ID}&slug=${encodeURIComponent(id)}`,
		)
		const found = payload.data?.[0]?.id
		if (found === undefined) {
			throw new Error(`CurseForge 上没有找到「${id}」。`)
		}
		modIdCache.set(id, found)
		return String(found)
	}

	/** One project's files, newest first. Restricted files carry a null URL. */
	async function filesOf(id: string): Promise<CfFile[]> {
		const resolved = await resolveModId(id)
		const payload = await get<{ data: CfFile[] }>(`/v1/mods/${encodeURIComponent(resolved)}/files`)
		return (payload.data ?? []).sort(
			(a, b) => Date.parse(b.fileDate) - Date.parse(a.fileDate),
		)
	}

	async function mod(id: string): Promise<CfMod> {
		const resolved = await resolveModId(id)
		const payload = await get<{ data: CfMod }>(`/v1/mods/${encodeURIComponent(resolved)}`)
		return payload.data
	}

	api.register({
		search,
		browse: search,

		async filters(contentType: string): Promise<ContentFilterGroup[]> {
			const classId = CLASS_IDS[contentType]
			if (!classId) return []
			const payload = await get<{ data: CfCategory[] }>(`/v1/categories?gameId=${GAME_ID}`)
			const categories = payload.data ?? []
			const datapackIds = new Set([DATAPACK_CATEGORY_ID])
			if (contentType === 'datapack') {
				let previousSize: number
				do {
					previousSize = datapackIds.size
					for (const category of categories) {
						if (category.parentCategoryId && datapackIds.has(category.parentCategoryId)) {
							datapackIds.add(category.id)
						}
					}
				} while (datapackIds.size !== previousSize)
			}
			const options = categories
				.filter((category) => contentType === 'datapack'
					? datapackIds.has(category.id)
					: category.classId === classId)
				.map((category) => ({ id: String(category.id), label: categoryLabel(category.name) }))
			if (options.length === 0) return []
			return [{ id: 'category', header: 'categories', options }]
		},

		async detail(id: string, contentType: string): Promise<ContentProject> {
			// The description endpoint, like the file one, only takes the numeric id.
			const resolved = await resolveModId(id)
			const [data, files, description] = await Promise.all([
				mod(id),
				filesOf(id).catch(() => [] as CfFile[]),
				get<{ data: string }>(`/v1/mods/${encodeURIComponent(resolved)}/description`),
			])

			return {
				...toCard(data, contentType),
				// CurseForge descriptions are HTML; the launcher's renderer passes
				// HTML through its sanitiser, so the body goes out as-is.
				body: description.data,
				links: data.links?.websiteUrl ? [{ label: 'CurseForge 页面', url: data.links.websiteUrl }] : [],
				versions: files
					.filter((file) => file.downloadUrl !== null)
					.map((file) => toVersion(file, data.links?.websiteUrl)),
			}
		},

		async versions(id: string): Promise<ContentVersion[]> {
			// The files endpoint carries no project URL, and a file's page lives under
			// its project's — so the project is read alongside, and a failure there
			// only costs the rows their "open on the site" link.
			const [files, data] = await Promise.all([
				filesOf(id),
				mod(id).catch(() => null),
			])
			return files
				.filter((file) => file.downloadUrl !== null)
				.map((file) => toVersion(file, data?.links?.websiteUrl))
		},

		async resolveDownload(id: string, versionId?: string, fileId?: string): Promise<DownloadDescriptor> {
			const files = await filesOf(id)
			const file = fileId
				? files.find((candidate) => String(candidate.id) === fileId)
				: versionId
					? files.find((candidate) => String(candidate.id) === versionId)
					: files[0]
			if (!file) {
				throw new Error('CurseForge 上没有这个文件，可能已被作者删除。')
			}
			if (!file.downloadUrl) {
				throw new Error(`「${file.displayName}」的作者禁止了第三方下载，只能通过 CurseForge 应用获取。`)
			}
			return {
				url: file.downloadUrl,
				fileName: file.fileName,
				hash: file.hashes.sha1 ? { algorithm: 'sha1', value: file.hashes.sha1 } : undefined,
			}
		},

		/**
		 * A CurseForge file's numeric id only ever grows within a project, so the
		 * newest file's id is the update marker — no dates to parse and compare.
		 */
		async checkUpdate(items: UpdateQueryItem[]): Promise<UpdateResult[]> {
			const results: UpdateResult[] = []
			for (const item of items) {
				try {
					const files = await filesOf(item.id)
					const latest = files.find((file) => file.releaseType === 1) ?? files[0]
					if (latest && String(latest.id) !== item.currentVersionId) {
						results.push({
							id: item.id,
							latestVersionId: String(latest.id),
							latestVersionName: latest.displayName,
						})
					} else {
						results.push({ id: item.id })
					}
				} catch (error) {
					api.log(`检查 ${item.id} 更新失败：${String(error)}`)
					results.push({ id: item.id })
				}
			}
			return results
		},

		/**
		 * The modpack plan: the manifest's loader setup, plus every file it names
		 * resolved to a URL. Resolution is one batched POST — CurseForge accepts
		 * up to 100 pairs per call, and packs rarely exceed that; the chunks walk
		 * the list for the ones that do.
		 */
		async resolveModpack(manifestJson: string): Promise<ContentModpackPlan> {
			const manifest = JSON.parse(manifestJson) as CfManifest
			if (manifest.manifestType && manifest.manifestType !== 'minecraftModpack') {
				throw new Error('这不是 CurseForge 整合包的 manifest。')
			}

			const loader = parseLoader(manifest.minecraft.modLoaders ?? [])
			const fileIds = manifest.files.map((file) => file.fileID)

			const files: ContentModpackPlan['files'] = []
			const planByFileId = new Map<string, ContentModpackPlan['files'][number]>()
			const answeredIds = new Set<string>()
			/** Files no endpoint would hand out, named for the log. */
			const skipped: string[] = []
			/** fileID → projectID, from the answered files themselves. */
			const projectOfFile = new Map<string, number>()
			const modIds = new Set<number>()
			const CHUNK = 100
			for (let start = 0; start < fileIds.length; start += CHUNK) {
				const chunk = fileIds.slice(start, start + CHUNK)
				const payload = await request('/v1/mods/files', {
					method: 'POST',
					body: JSON.stringify({ fileIds: chunk }),
				})
				const answered = JSON.parse(payload.body) as { data: CfFile[] }
				for (const file of answered.data ?? []) {
					answeredIds.add(String(file.id))
					if (!file.downloadUrl) {
						try {
							const mirrored = JSON.parse((await request(`/curseforge/v1/mods/${file.modId}/files/${file.id}`, { mirror: true })).body) as { data: CfFile }
							file.downloadUrl = mirrored.data.downloadUrl
						} catch (error) {
							api.log(`镜像未能解析 ${file.fileName}：${String(error)}`)
						}
					}
					// A file whose author forbade third-party downloads has no URL from
					// either endpoint. One such file must not cost the reader the whole
					// pack, so it is skipped and named in the launcher log; the reader
					// can fetch it from CurseForge by hand and drop it in.
					if (!file.downloadUrl) {
						skipped.push(file.fileName)
						api.log(`跳过无法下载的文件（作者禁止第三方下载）：${file.fileName}`)
						continue
					}
					if (file.modId) {
						projectOfFile.set(String(file.id), file.modId)
						modIds.add(file.modId)
					}
					const planFile = {
						url: file.downloadUrl,
						fileName: file.fileName,
						hashSha1: file.hashes.sha1,
					}
					planByFileId.set(String(file.id), planFile)
					files.push(planFile)
				}
			}

			// A file the manifest asked for but the API did not answer would install
			// an incomplete pack silently; name the first missing one instead.
			const missing = manifest.files.filter((file) => !answeredIds.has(String(file.fileID)))
			if (missing.length > 0) {
				throw new Error(`CurseForge 没有返回 ${missing.length} 个文件（首个 projectID ${missing[0].projectID} / fileID ${missing[0].fileID}）。`)
			}

			if (skipped.length > 0) {
				api.log(`整合包有 ${skipped.length} 个文件无法下载，已跳过：${skipped.join('、')}`)
			}

			// A manifest never says where a file belongs — the launcher has to be
			// told, and the answer is the file's project's class. One batched lookup
			// maps every project to its class, and the class to a folder.
			const folderOfProject = new Map<number, string>()
			if (modIds.size > 0) {
				const idList = [...modIds]
				for (let start = 0; start < idList.length; start += CHUNK) {
					const payload = await request('/v1/mods', {
						method: 'POST',
						body: JSON.stringify({ modIds: idList.slice(start, start + CHUNK) }),
					})
					const answered = JSON.parse(payload.body) as { data: CfMod[] }
					for (const entry of answered.data ?? []) {
						folderOfProject.set(entry.id, classFolder(entry.classId))
					}
				}
			}
			for (const [fileId, projectId] of projectOfFile) {
				const planFile = planByFileId.get(fileId)
				if (planFile) planFile.folder = folderOfProject.get(projectId) ?? 'mods'
			}

			return {
				gameVersion: manifest.minecraft.version,
				loader: loader.kind,
				loaderVersion: loader.version,
				files,
			}
		},
	})

	/**
	 * `modLoaders[].id` is a string like `forge-47.2.0`, `neoforge-20.4.80` or
	 * `fabric-0.15.11`. The primary loader is the one the pack means; anything
	 * unrecognized degrades to vanilla rather than guessing.
	 */
	function parseLoader(loaders: { id: string; primary?: boolean }[]): {
		kind: ContentModpackPlan['loader']
		version?: string
	} {
		const primary = loaders.find((loader) => loader.primary) ?? loaders[0]
		if (!primary) return { kind: 'vanilla' }
		const dash = primary.id.indexOf('-')
		if (dash === -1) return { kind: 'vanilla' }
		const kind = primary.id.slice(0, dash)
		const version = primary.id.slice(dash + 1)
		if (kind === 'forge' || kind === 'fabric' || kind === 'quilt') {
			return { kind, version }
		}
		if (kind === 'neoforge') {
			return { kind, version }
		}
		return { kind: 'vanilla' }
	}
}
