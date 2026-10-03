extends Node3D
## Hexling — Elmas Madeni (3B, Godot 4).
## Karanlık bir mağara labirenti: fener küçük bir alanı aydınlatır, ışık topları geçici olarak büyük bir alanı aydınlatır ve
## sonra yeniden kararır. Elmas/sandık/gizli iksir bulunur, çatlak duvarlar ışıkla yıkılır, raylı maden arabasıyla hızlı geçilir,
## yaratıklar (örümcek, yarasa, kaya devi) ışıkla vurulur. Cadı korunur: yalnızca madenin kendi "güç" göstergesi düşer.
## Çıkışa ulaşınca (ya da süre/güç bitince) sonuç, ana oyuna postMessage ile bildirilir.

const GW := 30
const GH := 30
const S := 3.0          # hücre boyu (m)
const WALL_H := 4.0
const MAX_TIME := 210.0
const QUOTA := 12          # çıkışın açılması için gereken elmas

var rng := RandomNumberGenerator.new()
var lang := "tr"
var grid := PackedByteArray()          # 1 = zemin, 0 = duvar
var rooms: Array[Rect2i] = []
var secret_cells := {}                 # Vector2i -> kırılabilir duvar düğümü
var start_cell := Vector2i.ZERO
var exit_cell := Vector2i.ZERO

var player: CharacterBody3D
var cam: Camera3D
var lantern: OmniLight3D
var enemies: Array = []
var pickups: Array = []
var boulders: Array = []
var carts: Array = []
var light_slots: Array = []            # {light, mode, t}
var orbs: Array = []                   # {node, vel, slot, life}

var diamonds := 0
var chests := 0
var potion := false
var meter := 100.0
var elapsed := 0.0
var finished := false
var cast_cd := 0.0
var shake := 0.0
var quota := QUOTA
var exit_gate: Node3D
var yaw := 0.0                         # kahraman/kamera yönü (0 = -Z)
var auto_dir := Vector3.ZERO
var hurt_cd := 0.0
var auto_cd := 0.0
var exit_label: Label3D
var need_cd := 0.0
var riding = null                      # binilen maden arabası

# arayüz
var hud: CanvasLayer
var lbl_dia: Label
var lbl_time: Label
var lbl_tip: Label
var bar: ProgressBar
var flash_rect: ColorRect
var stick: Control
var stick_id := -1
var stick_origin := Vector2.ZERO
var stick_vec := Vector2.ZERO
var tap_id := -1
var tap_start := Vector2.ZERO
var tap_time := 0.0

var debug_room := -1
var debug_cast := false
var debug_auto := false
var debug_enemies := false
var auto_path: Array = []
var tex_cache := {}
var mats := {}

const TXT := {
	"tr": {"tip": "Joystick ile yürü, dokunarak ışık topu at. Çatlak duvarları ışıkla kır.", "exit": "ÇIKIŞ", "need": "Çıkış kapalı: önce elmas topla", "ambush": "Pusu! Sandık yaratıkları uyandırdı", "hit": "Bir yaratık seni yakaladı!", "crash": "Kayaya çarptın!", "chest": "Sandık! +4 elmas", "potion": "Gizli iksir buldun! Madenden çıkınca 1 dk güç ×10", "cart": "Maden arabasına bin: hızlı geçiş", "secret": "Gizli bir oda açıldı!", "drop": "Yaratık elmas düşürdü!", "dark": "Fener söndü: süre bitti", "dead": "Gücün tükendi: maden bitti"},
	"en": {"tip": "Move with the joystick, tap to throw a light orb. Light cracked walls to break them.", "exit": "EXIT", "need": "Exit is locked: collect more diamonds", "ambush": "Ambush! The chest woke the creatures", "hit": "A creature caught you!", "crash": "You hit a boulder!", "chest": "Chest! +4 diamonds", "potion": "Hidden potion found! Power x10 for 1 min after you leave the mine", "cart": "Board the mine cart: fast ride", "secret": "A secret room opened!", "drop": "The creature dropped a diamond!", "dark": "The lantern died: time is up", "dead": "Out of power: the mine run is over"},
}

func t(key: String) -> String:
	return TXT.get(lang, TXT["tr"]).get(key, key)

func _ready() -> void:
	var seed_v = 0
	if OS.has_feature("web"):
		var s = JavaScriptBridge.eval("new URLSearchParams(window.location.search).get('seed')")
		if s != null:
			seed_v = int(str(s))
		var lg = JavaScriptBridge.eval("new URLSearchParams(window.location.search).get('lang')")
		if lg != null:
			lang = str(lg)
		var qv = JavaScriptBridge.eval("new URLSearchParams(window.location.search).get('quota')")
		if qv != null:
			quota = int(str(qv))
		var av = JavaScriptBridge.eval("new URLSearchParams(window.location.search).get('auto')")
		if av != null:
			debug_auto = true
	else:
		for a in OS.get_cmdline_user_args():
			if a.begins_with("--seed="):
				seed_v = int(a.substr(7))
			elif a.begins_with("--room="):
				debug_room = int(a.substr(7))
			elif a == "--cast":
				debug_cast = true
			elif a == "--auto":
				debug_auto = true
			elif a == "--enemies":
				debug_enemies = true
	if seed_v == 0:
		seed_v = int(Time.get_unix_time_from_system()) % 100000 + 1
	rng.seed = seed_v
	_make_environment()
	_make_materials()
	_gen_level()
	_build_level()
	_make_player()
	if debug_room >= 0:
		player.position = _cell_pos(_center(rooms[mini(debug_room, rooms.size() - 1)]))
		cam.global_position = player.position + Vector3(0, 6.0, 6.8)
	_make_light_pool()
	_place_content()
	_make_hud()
	if debug_enemies:
		var ks := ["spider", "bat", "wisp", "golem"]
		for i in range(ks.size()):
			_add_enemy(ks[i], player.position + Vector3(-4.0 + float(i) * 2.8, 0, -6.5))
	if debug_auto:
		_auto_plan()
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.parent.postMessage({type:'mine-ready'}, '*')")

# ---------------------------------------------------------------- ortam / malzeme
func _make_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0, 0, 0)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.20, 0.26, 0.40)
	env.ambient_light_energy = 0.28
	env.fog_enabled = true
	env.fog_light_color = Color(0, 0, 0)
	env.fog_density = 0.012
	env.glow_enabled = true
	env.glow_intensity = 0.9
	env.glow_bloom = 0.15
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

func _tex(name: String) -> Texture2D:
	if tex_cache.has(name):
		return tex_cache[name]
	var path := "res://tex/%s.png" % name
	var tx: Texture2D = null
	if ResourceLoader.exists(path):
		tx = load(path)
	tex_cache[name] = tx
	return tx

func _mat_tex(name: String, tint: Color = Color(1, 1, 1), rough: float = 0.95, metal: float = 0.0, uv_scale: float = 1.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = tint
	var a := _tex(name)
	if a != null:
		m.albedo_texture = a
	var n := _tex(name + "_n")
	if n != null:
		m.normal_enabled = true
		m.normal_texture = n
		m.normal_scale = 1.2
	m.roughness = rough
	m.metallic = metal
	m.uv1_scale = Vector3(uv_scale, uv_scale, uv_scale)
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	return m

func _mat_color(c: Color, emit: Color = Color(0, 0, 0), emit_energy: float = 0.0, rough: float = 0.6, metal: float = 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	if emit_energy > 0.0:
		m.emission_enabled = true
		m.emission = emit
		m.emission_energy_multiplier = emit_energy
	return m

func _make_materials() -> void:
	mats["wall"] = _mat_tex("rock_wall", Color(0.95, 0.95, 1.0))
	mats["floor"] = _mat_tex("rock_floor", Color(1, 0.97, 0.92))
	mats["ore"] = _mat_tex("ore", Color(1, 1, 1))
	mats["ore"].emission_enabled = true
	mats["ore"].emission = Color(0.2, 0.7, 0.9)
	mats["ore"].emission_energy_multiplier = 0.35
	mats["wood"] = _mat_tex("wood", Color(1, 1, 1))
	mats["metal"] = _mat_tex("metal", Color(0.9, 0.9, 0.95), 0.5, 0.5)
	mats["top"] = _mat_color(Color(0.05, 0.055, 0.075))
	mats["top"].shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mats["crystal"] = _mat_color(Color(0.55, 0.95, 1.0), Color(0.2, 0.85, 1.0), 2.2, 0.15, 0.2)
	mats["potion"] = _mat_color(Color(1.0, 0.5, 0.95), Color(1.0, 0.3, 0.9), 2.0, 0.2)
	mats["exit"] = _mat_color(Color(1.0, 0.95, 0.75), Color(1.0, 0.9, 0.6), 3.0)

# ---------------------------------------------------------------- seviye üretimi
func _idx(x: int, z: int) -> int:
	return z * GW + x

func _is_floor(x: int, z: int) -> bool:
	if x < 0 or z < 0 or x >= GW or z >= GH:
		return false
	return grid[_idx(x, z)] == 1

func _carve(x: int, z: int) -> void:
	if x > 0 and z > 0 and x < GW - 1 and z < GH - 1:
		grid[_idx(x, z)] = 1

func _carve_rect(r: Rect2i) -> void:
	for x in range(r.position.x, r.end.x):
		for z in range(r.position.y, r.end.y):
			_carve(x, z)

func _corridor(a: Vector2i, b: Vector2i, wide: int) -> void:
	var x := a.x
	var z := a.y
	var dir_x := 1 if b.x >= a.x else -1
	while x != b.x:
		for w in range(wide):
			_carve(x, z + w)
		x += dir_x
	var dir_z := 1 if b.y >= z else -1
	while z != b.y:
		for w in range(wide):
			_carve(x + w, z)
		z += dir_z
	for w in range(wide):
		_carve(x + w, z)
		_carve(x, z + w)

func _center(r: Rect2i) -> Vector2i:
	return Vector2i(r.position.x + r.size.x / 2, r.position.y + r.size.y / 2)

func _gen_level() -> void:
	grid.resize(GW * GH)
	grid.fill(0)
	rooms.clear()
	for attempt in range(80):
		if rooms.size() >= 10:
			break
		var w := rng.randi_range(4, 7)
		var h := rng.randi_range(4, 7)
		var x := rng.randi_range(2, GW - w - 3)
		var z := rng.randi_range(2, GH - h - 3)
		var r := Rect2i(x, z, w, h)
		var ok := true
		for o in rooms:
			if o.grow(2).intersects(r):
				ok = false
				break
		if ok:
			rooms.append(r)
			_carve_rect(r)
	rooms.sort_custom(func(a: Rect2i, b: Rect2i) -> bool: return a.position.x < b.position.x)
	for i in range(rooms.size() - 1):
		_corridor(_center(rooms[i]), _center(rooms[i + 1]), 2)
	for i in range(rooms.size() - 2):
		if rng.randf() < 0.35:
			_corridor(_center(rooms[i]), _center(rooms[i + 2]), 1)
	start_cell = _center(rooms[0])
	exit_cell = _center(rooms[rooms.size() - 1])

func _cell_pos(c: Vector2i) -> Vector3:
	return Vector3(c.x * S + S * 0.5, 0.0, c.y * S + S * 0.5)

func _face(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, n: Vector3, uv_a: Vector2, uv_b: Vector2, uv_c: Vector2, uv_d: Vector2) -> void:
	# a-b-c-d saat yönünün tersine (dışarıdan bakınca); iki üçgen
	for tri in [[a, c, b, uv_a, uv_c, uv_b], [a, d, c, uv_a, uv_d, uv_c]]:
		for k in range(3):
			st.set_normal(n)
			st.set_uv(tri[3 + k])
			st.add_vertex(tri[k])

func _build_level() -> void:
	sts.clear()
	var body := StaticBody3D.new()
	add_child(body)
	var u := S / 4.0
	for z in range(GH):
		for x in range(GW):
			var x0 := x * S
			var z0 := z * S
			var x1 := x0 + S
			var z1 := z0 + S
			if _is_floor(x, z):
				_face(_st("floor", x, z), Vector3(x0, 0, z1), Vector3(x1, 0, z1), Vector3(x1, 0, z0), Vector3(x0, 0, z0), Vector3.UP, Vector2(x * u, (z + 1) * u), Vector2((x + 1) * u, (z + 1) * u), Vector2((x + 1) * u, z * u), Vector2(x * u, z * u))
				continue
			var near_floor := false
			# kuzey (z-) komşu zemin ise kuzey yüz: normal -z... yüz, zemine bakar
			var dirs := [Vector2i(0, -1), Vector2i(0, 1), Vector2i(-1, 0), Vector2i(1, 0)]
			for d in dirs:
				if _is_floor(x + d.x, z + d.y):
					near_floor = true
					var st: SurfaceTool = _st("ore" if rng.randf() < 0.07 else "wall", x, z)
					var vu0 := (x + z) * u
					if d == Vector2i(0, -1):   # zemin kuzeyde: duvarın kuzey yüzü
						_face(st, Vector3(x1, 0, z0), Vector3(x0, 0, z0), Vector3(x0, WALL_H, z0), Vector3(x1, WALL_H, z0), Vector3(0, 0, -1), Vector2(vu0 + u, 1), Vector2(vu0, 1), Vector2(vu0, 0), Vector2(vu0 + u, 0))
					elif d == Vector2i(0, 1):  # güney yüz
						_face(st, Vector3(x0, 0, z1), Vector3(x1, 0, z1), Vector3(x1, WALL_H, z1), Vector3(x0, WALL_H, z1), Vector3(0, 0, 1), Vector2(vu0, 1), Vector2(vu0 + u, 1), Vector2(vu0 + u, 0), Vector2(vu0, 0))
					elif d == Vector2i(-1, 0): # batı yüz
						_face(st, Vector3(x0, 0, z0), Vector3(x0, 0, z1), Vector3(x0, WALL_H, z1), Vector3(x0, WALL_H, z0), Vector3(-1, 0, 0), Vector2(vu0, 1), Vector2(vu0 + u, 1), Vector2(vu0 + u, 0), Vector2(vu0, 0))
					else:                      # doğu yüz
						_face(st, Vector3(x1, 0, z1), Vector3(x1, 0, z0), Vector3(x1, WALL_H, z0), Vector3(x1, WALL_H, z1), Vector3(1, 0, 0), Vector2(vu0, 1), Vector2(vu0 + u, 1), Vector2(vu0 + u, 0), Vector2(vu0, 0))
			if near_floor:
				_face(_st("top", x, z), Vector3(x0, WALL_H, z1), Vector3(x1, WALL_H, z1), Vector3(x1, WALL_H, z0), Vector3(x0, WALL_H, z0), Vector3.UP, Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0))
				var cs := CollisionShape3D.new()
				var bs := BoxShape3D.new()
				bs.size = Vector3(S, WALL_H, S)
				cs.shape = bs
				cs.position = Vector3(x0 + S * 0.5, WALL_H * 0.5, z0 + S * 0.5)
				body.add_child(cs)
	# zemin çarpışması
	var fcs := CollisionShape3D.new()
	var fshape := BoxShape3D.new()
	fshape.size = Vector3(GW * S, 0.4, GH * S)
	fcs.shape = fshape
	fcs.position = Vector3(GW * S * 0.5, -0.2, GH * S * 0.5)
	body.add_child(fcs)
	_flush_surfaces()
	_make_secrets()
	_make_exit()

const CHUNK := 4
var sts := {}

func _st(mat_name: String, x: int, z: int) -> SurfaceTool:
	var key := "%s|%d|%d" % [mat_name, x / CHUNK, z / CHUNK]
	if not sts.has(key):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		sts[key] = st
	return sts[key]

func _flush_surfaces() -> void:
	for key in sts.keys():
		_add_surface(sts[key], String(key).split("|")[0])
	sts.clear()

func _add_surface(st: SurfaceTool, mat_name: String) -> void:
	st.generate_tangents()
	var mesh := st.commit()
	if mesh == null or mesh.get_surface_count() == 0:
		return
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mats[mat_name]
	add_child(mi)

func _make_exit() -> void:
	var p := _cell_pos(exit_cell)
	var pillar := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 1.0
	cm.bottom_radius = 1.0
	cm.height = 0.12
	pillar.mesh = cm
	pillar.material_override = mats["exit"]
	pillar.position = p + Vector3(0, 0.06, 0)
	add_child(pillar)
	var beam := MeshInstance3D.new()
	var bm := CylinderMesh.new()
	bm.top_radius = 0.7
	bm.bottom_radius = 0.7
	bm.height = 6.0
	bm.cap_top = false
	beam.mesh = bm
	var bmat := _mat_color(Color(1, 0.95, 0.7, 0.35), Color(1, 0.9, 0.55), 1.4)
	bmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	beam.material_override = bmat
	beam.position = p + Vector3(0, 3.0, 0)
	add_child(beam)
	var l := OmniLight3D.new()
	l.light_color = Color(1, 0.92, 0.65)
	l.light_energy = 0.7
	l.omni_range = 9.0
	l.position = p + Vector3(0, 2.0, 0)
	add_child(l)
	var lab := Label3D.new()
	lab.text = t("exit")
	lab.font_size = 48
	lab.pixel_size = 0.02
	lab.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lab.modulate = Color(1, 0.95, 0.7)
	lab.position = p + Vector3(0, 3.2, 0)
	add_child(lab)
	exit_label = lab
	var gate := load_model("gate_bars")
	if gate != null:
		gate.position = p + Vector3(0, 0, 0)
		gate.scale = Vector3(0.7, 0.7, 0.7)
		add_child(gate)
		exit_gate = gate

# ---------------------------------------------------------------- gizli odalar (ışıkla kırılan çatlak duvar)
func _make_secrets() -> void:
	var made := 0
	var tries := 0
	while made < 2 and tries < 400:
		tries += 1
		var room: Rect2i = rooms[rng.randi_range(0, rooms.size() - 1)]
		if room == rooms[0] or room == rooms[rooms.size() - 1]:
			continue
		# odanın bir kenarından dışarı: duvar hücresi w, arkasında alcove hücresi a
		var side := rng.randi_range(0, 3)
		var f := Vector2i.ZERO
		var d := Vector2i.ZERO
		match side:
			0: d = Vector2i(0, -1); f = Vector2i(rng.randi_range(room.position.x, room.end.x - 1), room.position.y)
			1: d = Vector2i(0, 1); f = Vector2i(rng.randi_range(room.position.x, room.end.x - 1), room.end.y - 1)
			2: d = Vector2i(-1, 0); f = Vector2i(room.position.x, rng.randi_range(room.position.y, room.end.y - 1))
			_: d = Vector2i(1, 0); f = Vector2i(room.end.x - 1, rng.randi_range(room.position.y, room.end.y - 1))
		var w := f + d
		var a := f + d * 2
		if a.x < 2 or a.y < 2 or a.x > GW - 3 or a.y > GH - 3:
			continue
		if _is_floor(w.x, w.y) or _is_floor(a.x, a.y):
			continue
		# alcove çevresi tamamen duvar olmalı (başka yere açılmasın)
		var clear := true
		for dx in range(-1, 2):
			for dz in range(-1, 2):
				var c := a + Vector2i(dx, dz)
				if c != a and c != w and _is_floor(c.x, c.y):
					clear = false
		if not clear or secret_cells.has(w):
			continue
		_carve(a.x, a.y)
		_spawn_secret_wall(w, made)
		_spawn_secret_loot(a, made)
		made += 1

func _spawn_secret_wall(w: Vector2i, which: int) -> void:
	var body := StaticBody3D.new()
	body.position = _cell_pos(w) + Vector3(0, WALL_H * 0.5, 0)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(S, WALL_H, S)
	cs.shape = bs
	body.add_child(cs)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(S, WALL_H, S)
	mi.mesh = bm
	var m := _mat_tex("ore", Color(1.0, 0.85, 0.7))
	m.emission_enabled = true
	m.emission = Color(0.9, 0.5, 0.2)
	m.emission_energy_multiplier = 0.25
	mi.material_override = m
	body.add_child(mi)
	add_child(body)
	secret_cells[w] = {"node": body, "hp": 3, "which": which}

func _spawn_secret_loot(a: Vector2i, which: int) -> void:
	var p := _cell_pos(a)
	if which == 0 and rng.randf() < 0.5:
		_add_potion(p + Vector3(0, 0.5, 0))
	else:
		_add_chest(p)
	for i in range(3):
		_add_diamond(p + Vector3(rng.randf_range(-0.9, 0.9), 0.7, rng.randf_range(-0.9, 0.9)))

# ---------------------------------------------------------------- 3B modeller (Quaternius CC0 canavarlar/büyücü, Kenney CC0 kapı)
func load_model(name: String) -> Node3D:
	var path := "res://models/%s.glb" % name
	if not ResourceLoader.exists(path):
		return null
	var ps = load(path)
	if ps == null:
		return null
	return ps.instantiate()

## model ağaçtayken çağrılır: boyunu hedef yüksekliğe ölçekler ve tabanını y=0'a oturtur
func fit_model(inst: Node3D, height: float) -> void:
	var box := AABB()
	var first := true
	for mi in inst.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var xf: Transform3D = inst.global_transform.affine_inverse() * m.global_transform
		var ta: AABB = xf * m.get_aabb()
		box = ta if first else box.merge(ta)
		first = false
	if first or box.size.y < 0.0001:
		return
	var sc := height / box.size.y
	inst.scale = Vector3.ONE * sc
	inst.position.y = -box.position.y * sc

func play_anim(root: Node, suffix: String, loop: bool = true) -> AnimationPlayer:
	for ap in root.find_children("*", "AnimationPlayer", true, false):
		var player_ap := ap as AnimationPlayer
		for an in player_ap.get_animation_list():
			if String(an).ends_with(suffix):
				var a := player_ap.get_animation(an)
				if loop:
					a.loop_mode = Animation.LOOP_LINEAR
				if player_ap.current_animation != an:
					player_ap.play(an, 0.15)
				return player_ap
	return null

# ---------------------------------------------------------------- oyuncu
var wiz_model: Node3D

func _make_player() -> void:
	player = CharacterBody3D.new()
	player.position = _cell_pos(start_cell)
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.45
	cap.height = 1.6
	cs.shape = cap
	cs.position = Vector3(0, 0.8, 0)
	player.add_child(cs)
	var model := Node3D.new()
	model.name = "Model"
	player.add_child(model)
	# cadı: cüppe, kafa, şapka, fener
	var robe := MeshInstance3D.new()
	var rm := CylinderMesh.new()
	rm.top_radius = 0.22
	rm.bottom_radius = 0.5
	rm.height = 1.0
	robe.mesh = rm
	robe.material_override = _mat_color(Color(0.45, 0.2, 0.7), Color(0, 0, 0), 0.0, 0.8)
	robe.position = Vector3(0, 0.5, 0)
	model.add_child(robe)
	var head := MeshInstance3D.new()
	var hm := SphereMesh.new()
	hm.radius = 0.22
	hm.height = 0.44
	head.mesh = hm
	head.material_override = _mat_color(Color(0.96, 0.8, 0.68))
	head.position = Vector3(0, 1.17, 0)
	model.add_child(head)
	var brim := MeshInstance3D.new()
	var bm := CylinderMesh.new()
	bm.top_radius = 0.42
	bm.bottom_radius = 0.42
	bm.height = 0.05
	brim.mesh = bm
	brim.material_override = _mat_color(Color(0.35, 0.15, 0.55))
	brim.position = Vector3(0, 1.33, 0)
	model.add_child(brim)
	var hat := MeshInstance3D.new()
	var tm := CylinderMesh.new()
	tm.top_radius = 0.0
	tm.bottom_radius = 0.28
	tm.height = 0.62
	hat.mesh = tm
	hat.material_override = _mat_color(Color(0.4, 0.17, 0.62))
	hat.position = Vector3(0, 1.66, 0)
	model.add_child(hat)
	var band := MeshInstance3D.new()
	var bnm := CylinderMesh.new()
	bnm.top_radius = 0.285
	bnm.bottom_radius = 0.3
	bnm.height = 0.09
	band.mesh = bnm
	band.material_override = _mat_color(Color(1, 0.8, 0.2), Color(1, 0.7, 0.1), 0.6)
	band.position = Vector3(0, 1.4, 0)
	model.add_child(band)
	var lamp := MeshInstance3D.new()
	var lm := SphereMesh.new()
	lm.radius = 0.12
	lm.height = 0.24
	lamp.mesh = lm
	lamp.material_override = _mat_color(Color(1, 0.9, 0.6), Color(1, 0.8, 0.4), 3.0)
	lamp.position = Vector3(0.42, 0.95, -0.25)
	model.add_child(lamp)
	lantern = OmniLight3D.new()
	lantern.light_color = Color(1.0, 0.82, 0.55)
	lantern.light_energy = 2.0
	lantern.omni_range = 8.5
	lantern.shadow_enabled = false  # gölge pahalı: web/telefonda takılmayı önler
	lantern.position = Vector3(0.6, 2.6, 0.9)
	player.add_child(lantern)
	for mi in model.get_children():
		if mi is MeshInstance3D:
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(player)
	# gerçek büyücü modeli (varsa) ilkel şekillerin yerini alır
	var wiz: Node3D = null  # cadı ilkel modelle kalır (kullanıcı kararı: cadı değiştirilmez)
	if wiz != null:
		for mi in model.get_children():
			if mi is MeshInstance3D and mi != null:
				mi.visible = false
		wiz.rotation.y = PI
		var holder := Node3D.new()
		holder.name = "WizHolder"
		model.add_child(holder)
		holder.add_child(wiz)
		fit_model(wiz, 1.9)
		wiz_model = wiz
		for mi in wiz.find_children("*", "MeshInstance3D", true, false):
			(mi as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		play_anim(wiz, "Idle")
		# fener elde kalsın
		var lamp_node := MeshInstance3D.new()
		var lsm := SphereMesh.new()
		lsm.radius = 0.12
		lsm.height = 0.24
		lamp_node.mesh = lsm
		lamp_node.material_override = _mat_color(Color(1, 0.9, 0.6), Color(1, 0.8, 0.4), 3.0)
		lamp_node.position = Vector3(0.45, 1.0, -0.35)
		lamp_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		model.add_child(lamp_node)
	cam = Camera3D.new()
	cam.fov = 66.0
	cam.far = 90.0
	add_child(cam)
	cam.global_position = player.global_position + Vector3(0, 6.0, 6.8)
	cam.look_at(player.global_position + Vector3(0, 0.5, -3.0), Vector3.UP)

func _make_light_pool() -> void:
	for i in range(3):
		var l := OmniLight3D.new()
		l.light_color = Color(1.0, 0.92, 0.65)
		l.light_energy = 0.0
		l.omni_range = 18.0
		add_child(l)
		light_slots.append({"light": l, "mode": "off", "t": 0.0})

# ---------------------------------------------------------------- içerik
func _random_floor_cell(avoid_start: bool = true) -> Vector2i:
	for k in range(200):
		var x := rng.randi_range(2, GW - 3)
		var z := rng.randi_range(2, GH - 3)
		if _is_floor(x, z):
			var c := Vector2i(x, z)
			if avoid_start and c.distance_to(start_cell) < 5.0:
				continue
			return c
	return start_cell

func _place_content() -> void:
	for i in range(26):
		_add_diamond(_cell_pos(_random_floor_cell()) + Vector3(rng.randf_range(-1, 1), 0.7, rng.randf_range(-1, 1)))
	for i in range(4):
		_add_chest(_cell_pos(_random_floor_cell()) + Vector3(rng.randf_range(-0.8, 0.8), 0, rng.randf_range(-0.8, 0.8)))
	var kinds := ["spider", "bat", "spider", "wisp", "golem"]
	for i in range(11):
		var c := _random_floor_cell()
		_add_enemy(kinds[i % kinds.size()], _cell_pos(c))
	for r in rooms:
		_decorate_room(r)
	_make_rails()

func _decorate_room(r: Rect2i) -> void:
	# ahşap destek kirişleri ve sarkıt/dikit
	for i in range(rng.randi_range(2, 4)):
		var c := Vector2i(rng.randi_range(r.position.x, r.end.x - 1), rng.randi_range(r.position.y, r.end.y - 1))
		if c == start_cell or c == exit_cell:
			continue
		var p := _cell_pos(c) + Vector3(rng.randf_range(-1, 1), 0, rng.randf_range(-1, 1))
		var mi := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.0
		cm.bottom_radius = rng.randf_range(0.3, 0.55)
		cm.height = rng.randf_range(0.9, 1.8)
		mi.mesh = cm
		mi.material_override = mats["wall"]
		mi.position = p + Vector3(0, cm.height * 0.5, 0)
		add_child(mi)
		var sb := StaticBody3D.new()
		var cs := CollisionShape3D.new()
		var sh := CylinderShape3D.new()
		sh.radius = cm.bottom_radius * 0.8
		sh.height = cm.height
		cs.shape = sh
		sb.position = mi.position
		sb.add_child(cs)
		add_child(sb)

func _add_diamond(p: Vector3) -> void:
	var n := Node3D.new()
	n.position = p
	for k in range(2):
		var mi := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.radial_segments = 6
		cm.rings = 1
		cm.top_radius = 0.0 if k == 0 else 0.22
		cm.bottom_radius = 0.22 if k == 0 else 0.0
		cm.height = 0.3
		mi.mesh = cm
		mi.material_override = mats["crystal"]
		mi.position = Vector3(0, 0.15 if k == 0 else -0.15, 0)
		n.add_child(mi)
	add_child(n)
	pickups.append({"node": n, "kind": "dia", "taken": false, "ph": rng.randf() * 6.0})

func _add_potion(p: Vector3) -> void:
	var n := Node3D.new()
	n.position = p
	var fl := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.2
	sm.height = 0.4
	fl.mesh = sm
	fl.material_override = mats["potion"]
	n.add_child(fl)
	var nk := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.07
	cm.bottom_radius = 0.09
	cm.height = 0.2
	nk.mesh = cm
	nk.material_override = mats["metal"]
	nk.position = Vector3(0, 0.28, 0)
	n.add_child(nk)
	add_child(n)
	pickups.append({"node": n, "kind": "potion", "taken": false, "ph": rng.randf() * 6.0})

func _add_chest(p: Vector3) -> void:
	var n := Node3D.new()
	n.position = p
	n.rotation.y = rng.randf() * TAU
	var body := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.9, 0.5, 0.6)
	body.mesh = bm
	body.material_override = mats["wood"]
	body.position = Vector3(0, 0.25, 0)
	n.add_child(body)
	var lid := MeshInstance3D.new()
	var lm := CylinderMesh.new()
	lm.top_radius = 0.3
	lm.bottom_radius = 0.3
	lm.height = 0.9
	lid.mesh = lm
	lid.rotation.z = PI / 2.0
	lid.material_override = mats["wood"]
	lid.position = Vector3(0, 0.52, 0)
	lid.scale = Vector3(1, 1, 1)
	n.add_child(lid)
	for sx in [-0.28, 0.28]:
		var band := MeshInstance3D.new()
		var bb := BoxMesh.new()
		bb.size = Vector3(0.08, 0.64, 0.66)
		band.mesh = bb
		band.material_override = mats["metal"]
		band.position = Vector3(sx, 0.34, 0)
		n.add_child(band)
	add_child(n)
	pickups.append({"node": n, "kind": "chest", "taken": false, "ph": 0.0})

func _add_enemy(kind: String, p: Vector3) -> void:
	var e := CharacterBody3D.new()
	e.set_script(load("res://enemy.gd"))
	e.position = p
	e.call("setup", kind, self)
	add_child(e)
	enemies.append(e)

# ---------------------------------------------------------------- raylar ve maden arabası
func _make_rails() -> void:
	# en uzun düz koridoru bul: odalar arası yatay bacak
	var best_len := 0
	var best_z := 0
	var best_x0 := 0
	for z in range(2, GH - 2):
		var run := 0
		for x in range(1, GW - 1):
			if _is_floor(x, z) and _is_floor(x, z + 1) and not _in_any_room(x, z):
				run += 1
				if run > best_len:
					best_len = run
					best_z = z
					best_x0 = x - run + 1
			else:
				run = 0
	if best_len < 6:
		return
	var x_a := best_x0 + 1
	var x_b := best_x0 + best_len - 2
	var zc := best_z + 1.0
	var a := Vector3(x_a * S + S * 0.5, 0.0, zc * S)
	var b := Vector3(x_b * S + S * 0.5, 0.0, zc * S)
	var length := a.distance_to(b)
	for off in [-0.6, 0.6]:
		var rail := MeshInstance3D.new()
		var rm := BoxMesh.new()
		rm.size = Vector3(length, 0.1, 0.1)
		rail.mesh = rm
		rail.material_override = mats["metal"]
		rail.position = (a + b) * 0.5 + Vector3(0, 0.12, off)
		add_child(rail)
	var nsl := int(length / 1.2)
	for i in range(nsl + 1):
		var sl := MeshInstance3D.new()
		var sm := BoxMesh.new()
		sm.size = Vector3(0.22, 0.07, 1.7)
		sl.mesh = sm
		sl.material_override = mats["wood"]
		sl.position = a.lerp(b, float(i) / float(nsl)) + Vector3(0, 0.05, 0)
		add_child(sl)
	_add_cart(a + Vector3(0, 0, 0), a, b)
	_add_cart(b + Vector3(0, 0, 0), b, a)
	# raydaki kayalar: ışık topuyla kırılmazsa araba çarpar
	for i in range(2):
		var f := 0.35 + 0.3 * float(i)
		var bp := a.lerp(b, f)
		var rock := MeshInstance3D.new()
		var sm2 := SphereMesh.new()
		sm2.radius = 0.7
		sm2.height = 1.2
		rock.mesh = sm2
		rock.material_override = mats["wall"]
		rock.position = bp + Vector3(0, 0.55, 0)
		rock.scale = Vector3(1.2, 0.9, 1.0)
		add_child(rock)
		boulders.append({"node": rock, "alive": true})

func _in_any_room(x: int, z: int) -> bool:
	for r in rooms:
		if r.grow(1).has_point(Vector2i(x, z)):
			return true
	return false

func _add_cart(p: Vector3, from_p: Vector3, to_p: Vector3) -> void:
	var n := Node3D.new()
	n.position = p + Vector3(0, 0.0, 0)
	var box := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(1.6, 0.6, 1.1)
	box.mesh = bm
	box.material_override = mats["metal"]
	box.position = Vector3(0, 0.55, 0)
	n.add_child(box)
	for sx in [-0.55, 0.55]:
		for sz in [-0.5, 0.5]:
			var w := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 0.2
			cm.bottom_radius = 0.2
			cm.height = 0.12
			w.mesh = cm
			w.rotation.x = PI / 2.0
			w.material_override = mats["wood"]
			w.position = Vector3(sx, 0.22, sz)
			n.add_child(w)
	var gem := MeshInstance3D.new()
	var gm := SphereMesh.new()
	gm.radius = 0.15
	gm.height = 0.3
	gem.mesh = gm
	gem.material_override = mats["crystal"]
	gem.position = Vector3(0, 0.95, 0)
	n.add_child(gem)
	add_child(n)
	carts.append({"node": n, "from": from_p, "to": to_p, "used": false})

# ---------------------------------------------------------------- arayüz
func _make_hud() -> void:
	hud = CanvasLayer.new()
	add_child(hud)
	var top := HBoxContainer.new()
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.offset_left = 18
	top.offset_right = -18
	top.offset_top = 14
	top.add_theme_constant_override("separation", 16)
	hud.add_child(top)
	var ic := Control.new()
	ic.custom_minimum_size = Vector2(34, 34)
	ic.draw.connect(func(): ic.draw_colored_polygon(PackedVector2Array([Vector2(17, 2), Vector2(32, 14), Vector2(17, 32), Vector2(2, 14)]), Color(0.45, 0.9, 1.0)))
	top.add_child(ic)
	lbl_dia = Label.new()
	lbl_dia.add_theme_font_size_override("font_size", 34)
	top.add_child(lbl_dia)
	bar = ProgressBar.new()
	bar.custom_minimum_size = Vector2(0, 26)
	bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bar.max_value = 100
	bar.show_percentage = false
	var sb_fill := StyleBoxFlat.new()
	sb_fill.bg_color = Color(0.35, 0.88, 0.48)
	sb_fill.set_corner_radius_all(10)
	var sb_bg := StyleBoxFlat.new()
	sb_bg.bg_color = Color(1, 1, 1, 0.15)
	sb_bg.set_corner_radius_all(10)
	bar.add_theme_stylebox_override("fill", sb_fill)
	bar.add_theme_stylebox_override("background", sb_bg)
	top.add_child(bar)
	lbl_time = Label.new()
	lbl_time.add_theme_font_size_override("font_size", 34)
	top.add_child(lbl_time)
	lbl_tip = Label.new()
	lbl_tip.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	lbl_tip.offset_top = -170
	lbl_tip.offset_bottom = -110
	lbl_tip.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl_tip.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lbl_tip.add_theme_font_size_override("font_size", 28)
	lbl_tip.text = t("tip")
	hud.add_child(lbl_tip)
	flash_rect = ColorRect.new()
	flash_rect.color = Color(1, 0.1, 0.1, 0.0)
	flash_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	flash_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(flash_rect)
	stick = Control.new()
	stick.set_anchors_preset(Control.PRESET_FULL_RECT)
	stick.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stick.draw.connect(_draw_stick)
	hud.add_child(stick)
	_paint()

func _draw_stick() -> void:
	if stick_id == -1:
		return
	stick.draw_circle(stick_origin, 90.0, Color(1, 1, 1, 0.12))
	stick.draw_arc(stick_origin, 90.0, 0, TAU, 40, Color(1, 1, 1, 0.5), 3.0)
	stick.draw_circle(stick_origin + stick_vec * 90.0, 38.0, Color(1, 1, 1, 0.45))

func _paint() -> void:
	lbl_dia.text = "%d" % diamonds
	bar.value = maxf(0.0, meter)
	lbl_time.text = "%d s" % int(maxf(0.0, MAX_TIME - elapsed))

func tip(key: String) -> void:
	lbl_tip.text = t(key)

func hurt(amount: float, key: String) -> void:
	if key == "hit":
		if hurt_cd > 0.0:
			return
		hurt_cd = 1.0
	meter -= amount
	shake = 0.5
	flash_rect.color = Color(1, 0.1, 0.1, 0.4)
	tip(key)
	if OS.has_feature("web"):
		JavaScriptBridge.eval("if (navigator.vibrate) navigator.vibrate(60)")

# ---------------------------------------------------------------- girdi
func _input(ev: InputEvent) -> void:
	if finished:
		return
	var half := get_viewport().get_visible_rect().size.x * 0.5
	if ev is InputEventScreenTouch:
		if ev.pressed:
			if ev.position.x < half and stick_id == -1:
				stick_id = ev.index
				stick_origin = ev.position
				stick_vec = Vector2.ZERO
				stick.queue_redraw()
			elif ev.position.x >= half and tap_id == -1:
				tap_id = ev.index
				tap_start = ev.position
				tap_time = Time.get_ticks_msec() / 1000.0
		else:
			if ev.index == stick_id:
				stick_id = -1
				stick_vec = Vector2.ZERO
				stick.queue_redraw()
			elif ev.index == tap_id:
				tap_id = -1
				cast_toward_screen(ev.position)
	elif ev is InputEventScreenDrag:
		if ev.index == stick_id:
			stick_vec = ((ev.position - stick_origin) / 90.0).limit_length(1.0)
			stick.queue_redraw()

func _move_vec() -> Vector3:
	var v := Vector2(stick_vec)
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		v.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		v.x += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		v.y -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		v.y += 1.0
	v = v.limit_length(1.0)
	return Vector3(v.x, 0, v.y)

func _ground_point(screen: Vector2) -> Vector3:
	var o := cam.project_ray_origin(screen)
	var d := cam.project_ray_normal(screen)
	var fwd := Vector3(-sin(yaw), 0, -cos(yaw))
	if d.y > -0.02:
		return player.global_position + fwd * 12.0
	var t_hit := -o.y / d.y
	return o + d * minf(t_hit, 40.0)

func cast_toward_screen(screen: Vector2) -> void:
	if finished or cast_cd > 0.0:
		return
	var tgt := _ground_point(screen)
	var dir := tgt - player.global_position
	dir.y = 0
	if dir.length() < 0.5:
		return
	cast_orb(dir.normalized())

func cast_orb(dir: Vector3) -> void:
	cast_cd = 0.28
	var n := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.16
	sm.height = 0.32
	n.mesh = sm
	n.material_override = _mat_color(Color(1, 0.95, 0.7), Color(1, 0.9, 0.5), 4.0)
	add_child(n)
	n.global_position = player.global_position + Vector3(0, 1.2, 0) + dir * 0.6
	var slot := 0
	for i in range(light_slots.size()):
		if light_slots[i]["mode"] == "off":
			slot = i
			break
		if light_slots[i]["t"] > light_slots[slot]["t"]:
			slot = i
	light_slots[slot]["mode"] = "fly"
	light_slots[slot]["t"] = 0.0
	orbs.append({"node": n, "vel": dir * 24.0, "slot": slot, "life": 1.4})

# ---------------------------------------------------------------- döngü
func _auto_fire(dt: float) -> void:
	# yaratıklara otomatik ışık topu: yakındaki en yakın yaratık (görüş hattı açıksa) hedeflenir
	auto_cd -= dt
	if auto_cd > 0.0 or finished:
		return
	var best = null
	var bd := 11.0
	var from := player.global_position + Vector3(0, 1.1, 0)
	var space := get_world_3d().direct_space_state
	for e in enemies:
		if not is_instance_valid(e) or not e.alive:
			continue
		var d: float = e.global_position.distance_to(player.global_position)
		if d >= bd:
			continue
		var q := PhysicsRayQueryParameters3D.create(from, e.global_position + Vector3(0, 1.0, 0))
		q.collision_mask = 1
		if space.intersect_ray(q).is_empty():
			bd = d
			best = e
	if best != null:
		var dir: Vector3 = best.global_position - player.global_position
		dir.y = 0
		if dir.length() > 0.5:
			cast_orb(dir.normalized())
			auto_cd = 0.6

func _auto_plan() -> void:
	# test: başlangıçtan çıkışa BFS yolu
	var prev := {}
	var q: Array = [start_cell]
	prev[start_cell] = start_cell
	while q.size() > 0:
		var c: Vector2i = q.pop_front()
		if c == exit_cell:
			break
		for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var n: Vector2i = c + d
			if _is_floor(n.x, n.y) and not prev.has(n):
				prev[n] = c
				q.append(n)
	var path: Array = []
	var cur := exit_cell
	while cur != start_cell and prev.has(cur):
		path.push_front(cur)
		cur = prev[cur]
	auto_path = path

func _auto_step() -> void:
	if auto_path.is_empty():
		return
	var tgt := _cell_pos(auto_path[0])
	var d := tgt - player.global_position
	d.y = 0
	if d.length() < 0.9:
		auto_path.pop_front()
		return
	auto_dir = d.normalized()
	# yakındaki yaratığa ışık topu
	var best = null
	var bd := 9.0
	for e in enemies:
		if is_instance_valid(e) and e.alive:
			var dd: float = e.global_position.distance_to(player.global_position)
			if dd < bd:
				bd = dd
				best = e
	if best != null and cast_cd <= 0.0:
		var dir: Vector3 = best.global_position - player.global_position
		dir.y = 0
		cast_orb(dir.normalized())

func _physics_process(dt: float) -> void:
	if finished:
		return
	if debug_auto:
		_auto_step()
	if debug_cast and int(elapsed * 10.0) % 8 == 0 and cast_cd <= 0.0:
		cast_orb(Vector3(0.5, 0, -1.0).normalized())
	elapsed += dt
	cast_cd = maxf(0.0, cast_cd - dt)
	hurt_cd = maxf(0.0, hurt_cd - dt)
	_auto_fire(dt)
	shake = maxf(0.0, shake - dt * 1.4)
	flash_rect.color.a = maxf(0.0, flash_rect.color.a - dt * 1.6)
	# oyuncu hareketi
	if riding == null:
		var inp := _move_vec()          # x: dön (sağ +), z: geri (+) / ileri (-)
		var spd := 6.2
		if debug_auto and auto_dir.length() > 0.01:
			var want := atan2(-auto_dir.x, -auto_dir.z)
			yaw = lerp_angle(yaw, want, minf(1.0, dt * 8.0))
			inp = Vector3(0, 0, -1.0 if absf(angle_difference(yaw, want)) < 0.6 else 0.0)
		else:
			yaw -= inp.x * 2.3 * dt
		var fwd := Vector3(-sin(yaw), 0, -cos(yaw))
		var along := -inp.z
		player.velocity = fwd * along * (spd if along > 0.0 else spd * 0.6)
		player.move_and_slide()
		player.global_position.y = 0.0
		var m: Node3D = player.get_node("Model")
		m.rotation.y = lerp_angle(m.rotation.y, yaw, minf(1.0, dt * 14.0))
		m.position.y = absf(sin(elapsed * 12.0)) * 0.05 if absf(along) > 0.1 and wiz_model == null else 0.0
		if wiz_model != null:
			play_anim(wiz_model, "Walk" if absf(along) > 0.1 else "Idle")
		_check_cart()
	else:
		_update_ride(dt)
	# kamera
	_update_camera(dt)
	_update_orbs(dt)
	_update_lights(dt)
	_update_pickups(dt)
	_check_exit()
	_paint()
	if meter <= 0.0:
		finish("dead")
	elif elapsed >= MAX_TIME:
		finish("dark")

func _update_camera(dt: float) -> void:
	# arkadan ve hafif yukarıdan takip kamerası: duvara girmesin diye oyuncudan kameraya ışın atılır
	var head := player.global_position + Vector3(0, 1.6, 0)
	var back := Vector3(sin(yaw), 0, cos(yaw))
	var desired := head + back * 6.8 + Vector3(0, 4.4, 0)
	var q := PhysicsRayQueryParameters3D.create(head, desired)
	q.collision_mask = 1
	var r := get_world_3d().direct_space_state.intersect_ray(q)
	if not r.is_empty():
		desired = r["position"] + (head - r["position"]).normalized() * 0.5
	cam.global_position = cam.global_position.lerp(desired, minf(1.0, dt * 9.0)) + Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)) * shake * 0.08
	var ahead := head + Vector3(-sin(yaw), 0, -cos(yaw)) * 3.0 - Vector3(0, 0.9, 0)
	cam.look_at(ahead, Vector3.UP)

func _update_orbs(dt: float) -> void:
	var space := get_world_3d().direct_space_state
	for i in range(orbs.size() - 1, -1, -1):
		var o = orbs[i]
		var node: Node3D = o["node"]
		var prev := node.global_position
		var next: Vector3 = prev + o["vel"] * dt
		o["life"] -= dt
		var hit := false
		var q := PhysicsRayQueryParameters3D.create(prev, next)
		q.collision_mask = 1
		var r := space.intersect_ray(q)
		if not r.is_empty():
			next = r["position"] - o["vel"].normalized() * 0.2
			hit = true
			_hit_wall(r["collider"], next)
		node.global_position = next
		var slot: Dictionary = light_slots[o["slot"]]
		slot["light"].global_position = next
		slot["light"].light_energy = 5.5
		for e in enemies:
			if is_instance_valid(e) and e.alive and e.global_position.distance_to(Vector3(next.x, e.global_position.y, next.z)) < 1.1:
				e.call("damage", 1)
				hit = true
				break
		for b in boulders:
			if b["alive"] and b["node"].global_position.distance_to(next) < 1.3:
				b["alive"] = false
				b["node"].queue_free()
				hit = true
		if hit or o["life"] <= 0.0:
			slot["mode"] = "flash"
			slot["t"] = 0.0
			slot["light"].global_position = next
			node.queue_free()
			orbs.remove_at(i)

func _hit_wall(collider: Object, _p: Vector3) -> void:
	for c in secret_cells.keys():
		var s = secret_cells[c]
		if s["node"] == collider:
			s["hp"] -= 1
			if s["hp"] <= 0:
				s["node"].queue_free()
				secret_cells.erase(c)
				tip("secret")
				shake = 0.4
			return

func _update_lights(dt: float) -> void:
	for s in light_slots:
		if s["mode"] == "flash":
			s["t"] += dt
			var k := maxf(0.0, 1.0 - s["t"] / 2.2)
			s["light"].light_energy = 10.0 * k * k
			if s["t"] >= 2.2:
				s["mode"] = "off"
				s["light"].light_energy = 0.0
		elif s["mode"] == "fly":
			s["t"] += dt

func _update_pickups(dt: float) -> void:
	for p in pickups:
		if p["taken"]:
			continue
		var n: Node3D = p["node"]
		if p["kind"] != "chest":
			n.rotation.y += dt * 2.0
			n.position.y += sin(elapsed * 3.0 + p["ph"]) * dt * 0.1
		if n.global_position.distance_to(player.global_position + Vector3(0, n.global_position.y, 0)) < 1.4:
			p["taken"] = true
			match p["kind"]:
				"dia":
					diamonds += 1
				"chest":
					chests += 1
					diamonds += 4
					tip("chest")
					_ambush()
				"potion":
					potion = true
					tip("potion")
			n.queue_free()
			if OS.has_feature("web"):
				JavaScriptBridge.eval("if (navigator.vibrate) navigator.vibrate(25)")

func _ambush() -> void:
	# sandık tuzağı: oyuncunun çevresinde 2 yaratık uyanır
	var made := 0
	for k in range(40):
		if made >= 2:
			break
		var ang := rng.randf() * TAU
		var pos := player.global_position + Vector3(cos(ang), 0, sin(ang)) * rng.randf_range(5.0, 8.0)
		var cx := int(pos.x / S)
		var cz := int(pos.z / S)
		if _is_floor(cx, cz):
			_add_enemy("spider" if made == 0 else "bat", pos)
			enemies[enemies.size() - 1].awake = true
			made += 1
	if made > 0:
		tip("ambush")

func enemy_died(e) -> void:
	if rng.randf() < 0.5:
		diamonds += 1
		tip("drop")

func _check_exit() -> void:
	if exit_label != null:
		exit_label.text = "%s %d/%d" % [t("exit"), mini(diamonds, quota), quota]
		exit_label.modulate = Color(1, 0.95, 0.7) if diamonds >= quota else Color(1, 0.55, 0.45)
		if exit_gate != null and diamonds >= quota and exit_gate.position.y < 3.0:
			exit_gate.position.y = lerpf(exit_gate.position.y, 3.2, 0.05)
	need_cd = maxf(0.0, need_cd - get_physics_process_delta_time())
	if player.global_position.distance_to(_cell_pos(exit_cell)) < 1.6:
		if diamonds >= quota:
			finish("exit")
		elif need_cd <= 0.0:
			need_cd = 3.0
			tip("need")

# ---------------------------------------------------------------- maden arabası
func _check_cart() -> void:
	for c in carts:
		if c["used"]:
			continue
		var n: Node3D = c["node"]
		if n.global_position.distance_to(player.global_position) < 1.8:
			riding = c
			c["used"] = true
			tip("cart")
			return

func _update_ride(dt: float) -> void:
	var c = riding
	var n: Node3D = c["node"]
	var to: Vector3 = c["to"]
	var dirv: Vector3 = (to - n.global_position)
	dirv.y = 0
	var step := 11.0 * dt
	# rayda kırılmamış kaya var mı
	for b in boulders:
		if b["alive"] and b["node"].global_position.distance_to(n.global_position) < 1.4:
			b["alive"] = false
			b["node"].queue_free()
			hurt(15.0, "crash")
	if dirv.length() <= step:
		n.global_position = to
		player.global_position = to + Vector3(0, 0, 1.6)
		riding = null
		# bitiş cart'ı diğer yönden yeniden kullanılabilir
		for oc in carts:
			if oc != c:
				oc["used"] = false
		return
	n.global_position += dirv.normalized() * step
	player.global_position = n.global_position + Vector3(0, 0.2, 0)
	var m: Node3D = player.get_node("Model")
	m.rotation.y = atan2(dirv.x, dirv.z) + PI

# ---------------------------------------------------------------- bitiş
func finish(reason: String) -> void:
	if finished:
		return
	finished = true
	if reason == "dark":
		tip("dark")
	elif reason == "dead":
		tip("dead")
	if reason != "exit":
		await get_tree().create_timer(1.6).timeout
	var res := {"diamonds": diamonds, "potion": potion, "chests": chests, "meter": maxf(0.0, meter), "reason": reason}
	var js := JSON.stringify(res)
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.parent.postMessage({type:'mine-result', result:%s}, '*')" % js)
	else:
		print("MINE_RESULT ", js)
		get_tree().create_timer(0.8).timeout.connect(func(): get_tree().quit())
