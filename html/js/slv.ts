import "ws";

type Command =
  | "service"
  | "open"
  | "next"
  | "direction"
  | "re"
  | "context"
  | "count"
  | "offset"
  | "dir"

type Argv = [Command, string | number]

type Dir =
  | "head"
  | "tail"

type Scroll = {
  "head": () => void,
  "tail": () => void,
}

type Fun = () => string

type State = {
  "today": number,
  "localtime": boolean,
  "file": string,
  "curfile": string,
  "count": number,
  "scale": number,
  "tab": string,

  "re": Fun | false,
  "context": Fun | false,
  "offset": Fun | false,
  "lineno": boolean,
}

var ws: WebSocket;
var state: State = {
  "today": -1,
  "localtime": true,
  "file": "stderr.log",
  "curfile": "stderr.log",
  "count": 0,
  "scale": 1,
  "tab": "tab_log",

  "re": false,
  "context": false,
  "offset": false,
  "lineno": false,
};

var config = {
  "service": function() {
    return (<HTMLInputElement>document.querySelector('input[name="archive"]:checked')!).value;
  },
  "direction": function(): Dir {
    return <Dir>(<HTMLInputElement>document.querySelector('input[name="direction"]:checked')!).value;
  },
  "re": function() {
    return (<HTMLInputElement>document.getElementById("re")!).value;
  },
  "context": function() {
    return (<HTMLInputElement>document.getElementById("context")!).value;
  },
  "count": function() {
    return (<HTMLInputElement>document.querySelector('input[name="count"]:checked')!).value;
  },
  "offset": function() {
    return (<HTMLInputElement>document.getElementById("offset")!).value;
  },
};

function filename(name: string, d: Date) {
  // @ts-ignore
  return state.file + dayjs(d).format(".YYYY-MM-DD");
}

function next_archive() {
  let archive = document.getElementsByName("archive");
  let checked = 0;

  for (var i = 0; i < archive.length; i++) {
    if ((<HTMLInputElement>archive[i]).checked) {
      checked = i;
      break;
    }
  }

  return (<HTMLInputElement>archive[(checked + 1) % archive.length]).value;
}

function yesterday() {
  state.today += 1;
  state.curfile = filename(
    state.file,
    // @ts-ignore
    dayjs().subtract(state.today, "days")
  );
  return state.curfile;
}

function tomorrow() {
  state.today -= 1;

  switch (state.today) {
    case -2:
      let archive = next_archive();
      (<HTMLInputElement>document.getElementById(archive)!).checked = true;
      state.today = -1;
      state.curfile = state.file;
      break;

    case -1:
      state.curfile = state.file;
      break;

    default:
      state.curfile = filename(
        state.file,
        // @ts-ignore
        dayjs().subtract(state.today, "days")
      );
      break;
  }

  return state.curfile;
}

function settitle(title: string) {
  document.title = title;
  stderr(config.service() + "/" + state.curfile);
}

function open(name: string) {
  clear();
  console.log(name);
  settitle(name);
  state.count = 0;
  xsend([
    <Argv>["service", config.service()],
    <Argv>["open", name],
    <Argv>["re", config.re()],
    <Argv>["offset", config.offset()],
    <Argv>["next", lines()]
  ]);
}

function stderr(msg: string) {
  let message = document.getElementById("message")!;
  message.textContent = msg;
}

function localtime(d: Date) {
  switch (state.localtime) {
    case true:
      // @ts-ignore
      return dayjs(d).format();
    case false:
      return d;
  }
}

function lineno() {
  return state.lineno
    ? '<font color="red">' + (state.count++) + '</font>'
    : "";
}

function format(msg: string) {
  try {
    var e = JSON.parse(msg);
    return lineno()
      + ' <font color="yellow">' + localtime(e.time) + '</font>'
      + ' <font color="green">' + e.host + '</font>'
      + ' <font color="silver">' + e.type + '</font>'
      + ' <font color="white">' + e.description + '</font>';
  } catch (error) {
    console.log(error);
    console.log(msg);
    return msg;
  }
}

function syslog(msg: string) {
  var log = document.getElementById("log")!;
  var entry = document.createElement("div");
  entry.innerHTML = format(msg);
  switch (config.direction()) {
    case "tail":
      log.insertBefore(entry, log.firstChild);
      break;

    case "head":
      log.insertBefore(entry, null);
      break;
  }
  scroll_to_top();
}

function send(arg0: Command, arg1: string | number) {
  console.log([arg0, arg1]);
  if (ws.readyState == ws.OPEN) {
    ws.send(arg0 + " " + arg1);
  }
}

function xsend(arg: Argv[]) {
  console.log(arg);

  switch (ws.readyState) {
    case ws.OPEN:
      arg.forEach(function ([arg0, arg1]) {
        send(arg0, arg1);
      });
      break;

    case ws.CLOSED:
      connect(function() {
        arg.forEach(function ([arg0, arg1]) {
          send(arg0, arg1);
        });
      });
      break;

    default:
      break;
  }
}

function clear() {
  document.getElementById("log")!.innerHTML = "";
}

function scroll_to_top() {
  var pager = document.getElementById("pager")!;
  var rect = pager.getBoundingClientRect();

  switch (config.direction()) {
    case "tail":
      window.scrollBy(0, rect.top)
      break;

    case "head":
      window.scrollBy(0, rect.bottom)
      break;
  }
}

function scroll_by_page(direction: Dir) {
  var pager = document.getElementById("pager");
  var n = window.innerHeight;
  switch (direction) {
    case "tail":
      break;

    case "head":
      n *= -1;
      break;
  }
  window.scrollBy(0, n);
}

function scroll(s: Scroll) {
  switch (config.direction()) {
    case "tail":
      if (s.tail)
        s.tail();
      break;

    case "head":
      if (s.head)
        s.head();
      break;
  }
}

function dir(d: Dir) {
  clear();
  state.count = 0;
  xsend([
    ["dir", d],
    ["next", lines()]
  ]);
}

function set_direction(f: HTMLInputElement) {
  console.log(f.value);
  dir(<Dir>f.value);
}

function service(s: State) {
  open(state.curfile);
}

function lines() {
  return Math.floor(window.innerHeight / (50 * state.scale));
}

function changed(setting: string, opt: any) {
  var t = (!opt || opt.type == undefined) ? "any" : opt.type;

  switch (t) {
    case "any":
      break;

    case "non_neg_integer":
      var id = <HTMLInputElement>document.getElementById(setting)!;
      var v = id.value;
      // @ts-ignore
      id["style"]["background-color"] = 'lightgreen';
      if (!/^[0-9]+$/.test(v)) {
        // @ts-ignore
        id["style"]["background-color"] = 'lightcoral';
      }
      break;

		case "regex":
			var id = <HTMLInputElement>document.getElementById(setting)!;
			var v = id.value;
      // @ts-ignore
			id["style"]["background-color"] = 'lightgreen';
			if (!/^[a-zA-Z0-9:|/\(\)\ \^\$\.\*\+\\_\-]*$/.test(v)) {
        // @ts-ignore
				id["style"]["background-color"] = 'lightcoral';
			}
			break;
  }
  // @ts-ignore
  state[setting] = (!opt || opt.bool == undefined) ? true : opt.bool;
}

function set_settings() {
  if (state.offset) {
    clear();
    state.offset = false;

    xsend([
      ["offset", config.offset()],
      ["next", lines()]
    ]);
  }

  if (state.context) {
    state.context = false;
    xsend([
      ["context", config.context()]
    ]);
  }

  if (state.re) {
    clear();
    state.re = false;
    xsend([
      ["re", config.re()],
      ["next", lines()]
    ]);
  }
}

function wsuri() {
  var hostname = window.location.hostname ? window.location.hostname : "localhost";
  var port = window.location.port;
  var protocol = window.location.protocol;
  var path = window.location.protocol;
  var pws = "ws:";

  if (protocol == "https:")
    pws = "wss:";

  if (port) port = ":" + port;

  return pws + "//" + hostname + port + window.location.pathname;
}

function connect(fun: () => void) {
  var uri = wsuri();

  console.log("connecting: " + uri);

  if (ws) ws.close();

  ws = new WebSocket(uri);

  ws.onopen = function() {
    fun();
  };
  ws.onclose = function() {
    stderr(config.service() + "/" + state.curfile + ': EOF');
  };
  ws.onmessage = function(event) {
    syslog(event.data);
  };
}

function loguri() {
  var protocol = window.location.protocol;
  var hostname = window.location.hostname ? window.location.hostname : "localhost";
  var port = window.location.port ? window.location.port : "8080";

  var uri = protocol + "//" + hostname + ":" + port + "/log/" +
    config.service() + "/" + state.curfile;

  console.log(uri);

  let e = <HTMLFormElement>document.getElementById('download')!;
  e.action = uri;
  e.method = "get";
}

function open_config(evt: FocusEvent, name: string) {
  var i, tabcontent, tablinks;

  state.tab = name;

  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    (<HTMLElement>tabcontent[i]).style.display = "none";
  }

  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }

  document.getElementById(name)!.style.display = "block";
  (<HTMLInputElement>evt.currentTarget!).className += " active";
}

function set_from_query_string(query: string) {
  if (!query) return;

  var p = query.split('&');

  p.forEach(function (s) {
    var [k, v] = s.split('=', 2);
    switch (k) {
      case "service":
      case "dir":
        var e = <HTMLInputElement>document.getElementById(v)!;
        e.checked = true;
        break;
      case "open":
        state.curfile = v;
        break;
      case "re":
        var re = <HTMLInputElement>document.getElementById("re")!;
        re.value = v;
        break;
    }
  });
}

function fontsize() {
  var log = document.getElementById('log')!;
  state.scale = state.scale == 1 ? 2 : 1;

  switch (state.scale) {
    case 1:
      log.style.fontSize = '1.5vw';
      break;

    case 2:
      log.style.fontSize = '3vw';
      break;
  }
}

function main() {
  var pager = document.getElementById("pager")!;
  var log = document.getElementById("log")!;
  var message = document.getElementById("message")!;
  var span = <HTMLElement>document.getElementsByClassName("close")![0];
  var settings = document.getElementById('settings')!;

  // @ts-ignore
  delete Hammer.defaults.cssProps.userSelect;
  // @ts-ignore
  var ctl = new Hammer(pager);
  // @ts-ignore
  ctl.get('swipe').set({ direction: Hammer.DIRECTION_ALL });
  ctl.get('press').set({ time: 600 });

  // @ts-ignore
  var status = new Hammer(message);
  status.get('press').set({ time: 600 });

  message.style.display = "inline-block";
  settitle(state.file);

  var query = decodeURI(location.href.split('?')[1]);

  set_from_query_string(query);

  connect(function() {
    open(state.curfile);
  });

  document.onkeypress = function (e) {
    switch (e.keyCode) {
      case 103: // g
        dir("head");
        break;

      case 71: // G
        dir("tail");
        break;
    };
  };

  document.onkeydown = function (e) {
    console.log(e.keyCode);
    switch (e.keyCode) {
      case 27: // esc
        switch (settings.style.display) {
          case "block":
            settings.style.display = "none";
            set_settings();
            break;

          case "none":
          case "":
            document.getElementById(state.tab)!.click();
            settings.style.display = "block";
            break;
        }
        break;

      case 33: // page up
        scroll({"tail": function() {
          if (window.scrollY == 0) {
            send("next", lines());
          }
          else {
            scroll_by_page("head");
          }
        },
          "head": function() {
            scroll_by_page("head")
          }});
        break;

      case 32: // space
      case 34: // page down
        scroll({"tail": function() { scroll_by_page("tail"); },
          "head": function() {
            if (window.innerHeight + window.scrollY == document.body.scrollHeight) {
              send("next", lines());
            }
            else {
              scroll_by_page("tail");
            }}});
        break;

      case 37: // <-
        open(yesterday());
        break;

      case 38: // up arrow
        scroll({"tail": function() {
          if (window.scrollY == 0) {
            send("next", 1);
          }
          else {
            scroll_by_page("head");
          }
        },
          "head": function() {
            scroll_by_page("head")
          }});
        break;

      case 39: // ->
        open(tomorrow());
        break;

      case 40: // down arrow
        scroll({"tail": function() { scroll_by_page("tail"); },
          "head": function() {
            if (window.innerHeight + window.scrollY == document.body.scrollHeight) {
              send("next", 1);
            }
            else {
              scroll_by_page("tail");
            }}});
        break;

      case 67: // c
        state.lineno = !state.lineno;
        break;

      case 68: // d
        clear();
        break;

      case 72: // h
        open(yesterday());
        break;

      case 74: // j
        scroll({"tail": function() { scroll_by_page("tail"); },
          "head": function() {
            if (window.innerHeight + window.scrollY == document.body.scrollHeight) {
              send("next", 1);
            }
            else {
              scroll_by_page("tail");
            }}});
        break;

      case 75: // k
        scroll({"tail": function() {
          if (window.scrollY == 0) {
            send("next", 1);
          }
          else {
            scroll_by_page("head");
          }
        },
          "head": function() {
            scroll_by_page("head")
          }});
        break;

      case 76: // l
        open(tomorrow());
        break;
    };
  };

  ctl.on("swipeleft", function(ev: any) {
    open(tomorrow());
  });

  ctl.on("swiperight", function(ev: any) {
    open(yesterday());
  });

  ctl.on("swipedown", function(ev: any) {
    scroll({"tail": function() {
      if (window.scrollY == 0) {
        send("next", lines());
      }
      else {
        scroll_by_page("head");
      }
    },
      "head": function() {
        scroll_by_page("head")
      }});
  });

  ctl.on("swipeup", function(ev: any) {
    scroll({"tail": function() { scroll_by_page("tail"); },
      "head": function() {
        if (window.innerHeight + window.scrollY == document.body.scrollHeight) {
          send("next", lines());
        }
        else {
          scroll_by_page("tail");
        }}});
  });

  ctl.on("doubletap", function(ev: any) { fontsize() });
  status.on("doubletap", function(ev: any) { fontsize() });

  ctl.on("press", function(ev: any) {
    document.getElementById(state.tab)!.click();
    settings.style.display = "block";
  });

  status.on("press", function(ev: any) {
    document.getElementById(state.tab)!.click();
    settings.style.display = "block";
  });

  span.onclick = function() {
    settings.style.display = "none";
    set_settings();
  }

  // @ts-ignore
  window.onclick = function(event) {
    if (event.target == settings) {
      settings.style.display = "none";
      set_settings();
    }
  }
}
