extends Node

# Keep the callback alive for the lifetime of the browser runtime.
var visibility_callback: JavaScriptObject
var was_muted: bool = false
var backgrounded: bool = false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if not OS.has_feature("web"): return
	visibility_callback = JavaScriptBridge.create_callback(_visibility_changed)
	JavaScriptBridge.get_interface("window").brushlineVisibility = visibility_callback

func _visibility_changed(arguments: Array) -> void:
	var hidden := bool(arguments[0])
	if hidden == backgrounded: return
	backgrounded = hidden
	if hidden:
		was_muted = AudioServer.is_bus_mute(0)
		AudioServer.set_bus_mute(0,true)
		var app := get_tree().current_scene
		if app == null: return
		var demo: Node = app.get("showcase")
		if is_instance_valid(demo): demo.set_playing(false)
		var race: Node = app.get("race")
		if is_instance_valid(race) and race.has_method("_safety_pause"):
			race.call("_safety_pause")
			race.set("startup_focus_pause",false)
	else:
		AudioServer.set_bus_mute(0,was_muted)
	# Driving/demo stays paused until the player explicitly continues.

# Wall-clock frames rather than physics ticks or a CSS-sized canvas. Metrics
# stay on this page; no network telemetry and no change to player saves.
var sample_frames: Array[float] = []
var previous_tick: int = 0
var sample_elapsed: float = 0.0

func _process(_delta: float) -> void:
	if not OS.has_feature("web"): return
	var now := Time.get_ticks_usec()
	var frame_ms := float(now-previous_tick)/1000.0 if previous_tick>0 else 0.0
	previous_tick=now
	var app := get_tree().current_scene
	var active := false
	var pixels := get_window().size
	if app != null and not backgrounded and not get_tree().paused:
		var race: Node = app.get("race")
		var demo: Node = app.get("showcase")
		active=is_instance_valid(race) and not race.controls.blocked
		if is_instance_valid(demo) and demo.ready_to_play and demo.playing:
			active=true
			if demo.worlds.has(demo.active_world): pixels=demo.worlds[demo.active_world].viewport.size
	if not active or frame_ms<=0 or frame_ms>1000:
		sample_frames.clear()
		sample_elapsed=0
		return
	sample_frames.append(frame_ms)
	sample_elapsed+=frame_ms
	if sample_elapsed<2000: return
	var fps := sample_frames.size()*1000.0/sample_elapsed
	sample_frames.sort()
	var p95 := sample_frames[mini(sample_frames.size()-1,int(sample_frames.size()*.95))]
	JavaScriptBridge.get_interface("window").brushlineFrameSample(fps,p95,pixels.x,pixels.y,Performance.get_monitor(Performance.TIME_PROCESS)*1000.0,Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
	sample_frames.clear()
	sample_elapsed=0
