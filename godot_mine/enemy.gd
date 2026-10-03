extends CharacterBody3D
## Maden yaratıkları: örümcek (yerde hızlı), yarasa (havada kıvrak), kaya devi (yavaş, sağlam).
## Hepsi kahramandan zayıftır: 1-5 ışık topu vuruşuyla ölür ve az güç götürür. Karanlıkta görünmezler; ışık onları ortaya çıkarır.

var kind := "spider"
var hp := 2
var speed := 3.0
var touch_dmg := 6.0
var alive := true
var awake := false
var stun := 0.0
var main_ref
var phase := 0.0
var legs: Array = []
var wings: Array = []
var body_node: Node3D
var model_ready := false
var model_inst: Node3D
var fly_h := 0.0
var move_anim := "Walk"
var idle_anim := "Idle"

func setup(k: String, m) -> void:
	kind = k
	main_ref = m
	phase = randf() * 6.0
	match kind:
		"spider":
			hp = 2
			speed = 3.4
			touch_dmg = 4.0
		"bat":
			hp = 1
			speed = 4.2
			touch_dmg = 3.5
		"wisp":
			hp = 2
			speed = 3.6
			touch_dmg = 4.5
		"golem":
			hp = 5
			speed = 1.9
			touch_dmg = 8.0
	var cs := CollisionShape3D.new()
	var sh := SphereShape3D.new()
	sh.radius = 0.6 if kind != "golem" else 0.9
	cs.shape = sh
	cs.position = Vector3(0, sh.radius, 0)
	add_child(cs)
	collision_layer = 2
	collision_mask = 1
	body_node = Node3D.new()
	add_child(body_node)
	model_ready = false

func _ready() -> void:
	# gerçek 3B model: ağaçtayken ölçeklenir; bulunamazsa ilkel şekiller kurulur
	var spec := {"spider": ["blob", 1.1, 0.0, "Walk", "Idle"], "bat": ["armabee", 1.3, 1.5, "Fast_Flying", "Flying_Idle"], "wisp": ["ghostskull", 1.2, 1.4, "Fast_Flying", "Flying_Idle"], "golem": ["goleling", 2.7, 0.5, "Fast_Flying", "Flying_Idle"]}
	var sp = spec.get(kind, spec["spider"])
	var inst: Node3D = main_ref.load_model(sp[0])
	if inst != null:
		inst.rotation.y = PI
		body_node.add_child(inst)
		main_ref.fit_model(inst, sp[1])
		model_inst = inst
		fly_h = sp[2]
		move_anim = sp[3]
		idle_anim = sp[4]
		inst.position.y += fly_h
		for mi in inst.find_children("*", "MeshInstance3D", true, false):
			(mi as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		main_ref.play_anim(inst, idle_anim)
		model_ready = true
		return
	match kind:
		"spider":
			_build_spider()
		"bat", "wisp":
			_build_bat()
		"golem":
			_build_golem()

func _mat(c: Color, e: Color = Color(0, 0, 0), en: float = 0.0, r: float = 0.7) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = r
	if en > 0.0:
		m.emission_enabled = true
		m.emission = e
		m.emission_energy_multiplier = en
	return m

func _mesh(node: MeshInstance3D, mesh: Mesh, mat: Material, pos: Vector3) -> MeshInstance3D:
	node.mesh = mesh
	node.material_override = mat
	node.position = pos
	return node

func _build_spider() -> void:
	var body := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.42
	sm.height = 0.7
	body_node.add_child(_mesh(body, sm, _mat(Color(0.12, 0.1, 0.14)), Vector3(0, 0.5, 0)))
	var head := MeshInstance3D.new()
	var hm := SphereMesh.new()
	hm.radius = 0.25
	hm.height = 0.45
	body_node.add_child(_mesh(head, hm, _mat(Color(0.16, 0.12, 0.18)), Vector3(0, 0.5, -0.42)))
	for sx in [-0.1, 0.1]:
		var eye := MeshInstance3D.new()
		var em := SphereMesh.new()
		em.radius = 0.05
		em.height = 0.1
		body_node.add_child(_mesh(eye, em, _mat(Color(1, 0.1, 0.1), Color(1, 0.1, 0.1), 3.0), Vector3(sx, 0.55, -0.62)))
	for i in range(8):
		var side := -1.0 if i < 4 else 1.0
		var k := i % 4
		var leg := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.035
		cm.bottom_radius = 0.025
		cm.height = 0.95
		leg.mesh = cm
		leg.material_override = _mat(Color(0.1, 0.08, 0.12))
		leg.position = Vector3(side * 0.55, 0.38, -0.3 + k * 0.2)
		leg.rotation = Vector3(0, 0, side * 1.0)
		body_node.add_child(leg)
		legs.append(leg)

func _build_bat() -> void:
	var body := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.22
	sm.height = 0.5
	body_node.add_child(_mesh(body, sm, _mat(Color(0.18, 0.14, 0.2)), Vector3(0, 1.5, 0)))
	for sx in [-1.0, 1.0]:
		var w := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.9, 0.04, 0.5)
		w.mesh = bm
		w.material_override = _mat(Color(0.14, 0.1, 0.18))
		w.position = Vector3(sx * 0.5, 1.5, 0)
		body_node.add_child(w)
		wings.append(w)
	for sx in [-0.08, 0.08]:
		var eye := MeshInstance3D.new()
		var em := SphereMesh.new()
		em.radius = 0.04
		em.height = 0.08
		body_node.add_child(_mesh(eye, em, _mat(Color(1, 0.8, 0.1), Color(1, 0.8, 0.1), 3.0), Vector3(sx, 1.55, -0.2)))

func _build_golem() -> void:
	var rock := load("res://tex/rock_wall.png")
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.7, 0.66, 0.62)
	if rock != null:
		mat.albedo_texture = rock
	mat.roughness = 1.0
	var parts := [
		[Vector3(1.1, 1.0, 0.8), Vector3(0, 1.1, 0)],
		[Vector3(0.7, 0.6, 0.6), Vector3(0, 1.95, 0)],
		[Vector3(0.45, 1.0, 0.45), Vector3(-0.85, 1.0, 0)],
		[Vector3(0.45, 1.0, 0.45), Vector3(0.85, 1.0, 0)],
		[Vector3(0.5, 0.7, 0.5), Vector3(-0.3, 0.35, 0)],
		[Vector3(0.5, 0.7, 0.5), Vector3(0.3, 0.35, 0)],
	]
	for p in parts:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = p[0]
		body_node.add_child(_mesh(mi, bm, mat, p[1]))
	for sx in [-0.15, 0.15]:
		var eye := MeshInstance3D.new()
		var em := BoxMesh.new()
		em.size = Vector3(0.12, 0.08, 0.05)
		body_node.add_child(_mesh(eye, em, _mat(Color(0.3, 0.9, 1), Color(0.3, 0.9, 1), 3.0), Vector3(sx, 2.0, -0.32)))

func damage(n: int) -> void:
	if not alive:
		return
	hp -= n
	stun = 0.35
	awake = true
	var tw := create_tween()
	tw.tween_property(body_node, "scale", Vector3(1.25, 0.8, 1.25), 0.06)
	tw.tween_property(body_node, "scale", Vector3.ONE, 0.12)
	if hp <= 0:
		alive = false
		if model_inst != null:
			main_ref.play_anim(model_inst, "Death", false)
		main_ref.enemy_died(self)
		var tw2 := create_tween()
		tw2.tween_property(body_node, "scale", Vector3(0.01, 0.01, 0.01), 0.25)
		tw2.tween_callback(queue_free)

func _physics_process(dt: float) -> void:
	if not alive or main_ref == null or main_ref.finished:
		return
	phase += dt
	var pl: Node3D = main_ref.player
	var to := pl.global_position - global_position
	to.y = 0
	var d := to.length()
	if not awake and d < 11.0:
		awake = true
	stun = maxf(0.0, stun - dt)
	if awake and stun <= 0.0 and d > 0.001:
		var dir := to / d
		if kind == "bat":
			dir = (dir + Vector3(cos(phase * 3.0), 0, sin(phase * 2.3)) * 0.7).normalized()
		velocity = dir * speed
		move_and_slide()
		body_node.rotation.y = atan2(dir.x, dir.z) + PI
	else:
		velocity = Vector3.ZERO
	global_position.y = 0.0
	if model_ready:
		main_ref.play_anim(model_inst, move_anim if (awake and stun <= 0.0) else idle_anim)
	elif kind == "spider":
		for i in range(legs.size()):
			legs[i].rotation.x = sin(phase * 12.0 + float(i)) * 0.35
	elif kind == "bat":
		for w in wings:
			w.rotation.z = sin(phase * 18.0) * (0.5 if w.position.x > 0 else -0.5)
		body_node.position.y = sin(phase * 4.0) * 0.12
	elif kind == "golem":
		body_node.position.y = absf(sin(phase * 3.0)) * 0.05
	if d < 1.3 and stun <= 0.0:
		main_ref.hurt(touch_dmg, "hit")
		stun = 1.6
		var away := (global_position - pl.global_position)
		away.y = 0
		global_position += away.normalized() * 1.6
