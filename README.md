# slv

Elasticsearch, ugh, Kibana, meh ... all you wanted to do was look at a
few log files, maybe see what happened in the last hour or grep through
for something that happened a few days ago.

Shouldn't be hard, but what do you have to show except gigabytes of
squandered memory, terabytes of disk wasted, processes stuck in the
run queue and an ongoing maintenance burden?

`slv` is a stupidly simple viewer for actual log files on disk. How
the log files get there and how they are rotated is up to you.

`slv` is a SPA that streams log files over a websocket. `slv` uses
touch gestures on mobile and uses vi style keyboard shortcuts everywhere
else. There is also a command line interface.

## Screenshot

~~~
2019-03-29T21:55:16.000Z host1 stderr/service java.io.IOException: Connection reset by peer
2019-03-29T21:55:16.000Z host1 stderr/service     at sun.nio.ch.FileDispatcherImpl.read0(Native Method)
2019-03-29T21:55:16.000Z host1 stderr/service     at sun.nio.ch.SocketDispatcher.read(SocketDispatcher.java:39)
2019-03-29T21:55:16.000Z host1 stderr/service     at sun.nio.ch.IOUtil.readIntoNativeBuffer(IOUtil.java:223)
2019-03-29T21:55:16.000Z host1 stderr/service     at sun.nio.ch.IOUtil.read(IOUtil.java:192)
2019-03-29T21:55:16.000Z host1 stderr/service     at sun.nio.ch.SocketChannelImpl.read(SocketChannelImpl.java:380)
~~~

## Installation

### Requirements

* [websocketd](http://websocketd.com/)

* cli usage: [wsta](https://github.com/esphen/wsta)

### Configuration

~~~ shell
git clone https://github.com/msantos/slv
cd slv
~~~

~~~ shell
#!/bin/sh

BASEDIR="${BASEDIR-.}"

export PATH=$PATH:$BASEDIR/bin

exec websocketd \
    --loglevel="$SLV_LOGLEVEL" \
    --passenv=SLV_LOGDIR \
    --passenv=SLV_FILE \
    --passenv=SLV_SERVICE \
    --passenv=SLV_DIR \
    --passenv=SLV_CONTEXT \
    --reverselookup=false \
    --address=127.0.0.1 \
    --port=8080 \
    --staticdir=$BASEDIR/html \
    slv
~~~

### Environment Variables

* `SLV_LOGDIR`: path to log directory (default: log)

  This directory contains one or more service directories holding
  logfiles.

* `SLV_SERVICE`: the default service directory (default: system)

* `SLV_FILE`: name of the log file (default: stderr.log)

  The default log rotation date format is: `.YYYY-MM-DD`

* `SLV_DIR`: default direction for paging through file

      * tail: newest data first
      * head: oldest data first

  (default: tail)

### Directory Layout

~~~
$SLV_LOGDIR -+-$SLV_SERVICE-+-stderr.log
             |              |-stderr.log-2018-08-08
             |              |-stderr.log-2018-08-07
             |              |-stderr.log-2018-08-06
             |              |-stderr.log-2018-08-05
             |
             |-other_service
             |-another_service
~~~

### nginx

Don't expose `slv` directly to the internet!

Well, unless you want to make your log files public. Otherwise, set it
up behind something like nginx as follows:

* Generate a uuid:

    # example only, don't use this uuid
    $ uuidgen
    e84656e6-7972-4223-b593-ac24c1320663

* Configure nginx (assuming you're using let's encrypt):

~~~
server {
    listen              443 ssl;
    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    location = /e84656e6-7972-4223-b593-ac24c1320663/slv {
        return 302 /e84656e6-7972-4223-b593-ac24c1320663/slv/;
    }
    location  /e84656e6-7972-4223-b593-ac24c1320663/slv/ {
        rewrite /e84656e6-7972-4223-b593-ac24c1320663/slv/(.*) /$1  break;

        proxy_pass http://127.0.0.1:8080/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
        proxy_redirect off;
    }
}
~~~

## Features

## (Mis)Features

* Highly configurable!

  Translation: you might have to change the source code to make it work!

* Just like reading logs in a terminal!

  Translation: it's ugly!

* Mobile friendly!

  Translation: the touch interface sort of works!

* Actively maintained!

  Translation: it's buggy!

* Highly secure!

  Translation: probably not! It's a shell script! I ran shellcheck!

* Educational!

  Translation: feel free to read the javascript, shake your head and
  silently judge me! Then send a patch!
