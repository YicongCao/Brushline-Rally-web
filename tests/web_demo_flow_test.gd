extends SceneTree
func _initialize() -> void: run.call_deferred()
func run() -> void:
 var app := RallyGameApp.new()
 app.web_demo=true
 app.profile.path="user://tests-web-demo/profile.json"
 root.add_child(app)
 for i in range(18000):
  await process_frame
  if app.screen=="race" and not app.loading: break
 assert(app.screen=="race" and not app.loading,"Demo must reach driving without menu input")
 assert(app.chosen_stage=="sunset_ridge" and app.chosen_vehicle=="F160" and app.chosen_power_tier==0)
 assert("结束试玩" in text_tree(app.race.pause_menu))
 app.show_results({"elapsed":90.0,"penalty":0.0,"total_time":90.0,"splits":[],"outcome":{"eligible":false,"new_best":false}})
 var labels := text_tree(app.ui)
 assert("下载 Win / Mac 客户端" in labels and "再跑一次" in labels)
 assert(not "更换车辆" in labels and not "返回赛道选择" in labels)
 if DisplayServer.get_name()!="headless":
  await create_timer(.4).timeout
  await RenderingServer.frame_post_draw
  root.get_texture().get_image().save_png("res://logs/web-demo-results.png")
 app.retry()
 assert(app.screen=="race" and not paused)
 app._clear_race("stages")
 assert(app.screen=="demo_end")
 assert("下载完整客户端" in text_tree(app.ui))
 print("PASS automatic demo entry, fixed content, finish download CTA, retry, exit screen")
 quit()
func text_tree(node: Node) -> String:
 var result := str(node.text) if node is Label or node is Button else ""
 for child in node.get_children(): result += text_tree(child)
 return result
