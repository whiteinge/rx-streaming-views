var Benchmark = require('benchmark');
var Rx = require('rx');
var _ = require('lodash');

var suite = new Benchmark.Suite;

suite
    .add('plainSubject', plainSubject)
    .add('middlewareSubjectEmpty', middlewareSubjectEmpty)
    .add('middlewareSubjectSimple', middlewareSubjectSimple)
    .add('middlewareSubjectComplex', middlewareSubjectComplex)
    .on('cycle', function(event) {
        console.log(String(event.target));
    })
    .on('complete', function() {
        console.log('Fastest is ' + this.filter('fastest').map('name'));
    })
    .run({ 'async': true });

// ----------------------------------------------------------------------------

function plainSubject() {
    var Actions = new Rx.Subject();

    var Dispatcher = Actions
        .asObservable()
        .share();

    Dispatcher.map(x => x).filter(x => x !== null).subscribe();
    Dispatcher.map(x => x).filter(x => x !== null).subscribe();

    Dispatcher.subscribe();
    Rx.Observable.range(0, 10000).subscribe(Actions);
}

function middlewareSubjectEmpty() {
    var Actions = new Rx.Subject();

    var Dispatcher = Actions
        .asObservable()
        .publish(applyMiddleware)
        .share();

    Dispatcher.subscribe();

    Rx.Observable.range(0, 10000).subscribe(Actions);
}

function middlewareSubjectSimple() {
    var Actions = new Rx.Subject();

    var Dispatcher = Actions
        .asObservable()
        .publish(applyMiddleware)
        .share();

    Dispatcher.subscribe();

    Actions.onNext({tag: 'register', data: {
        middleware: {
            'notBar': function notBar(o) {
                return o
                    .filter(x => x.tag !== 'bar')
                    .takeUntil(o.filter(x => x.tag === 'unregister'));
            },
        },
    }})

    Rx.Observable.range(0, 10000).subscribe(Actions);
}

function middlewareSubjectComplex() {
    var Actions = new Rx.Subject();

    var Dispatcher = Actions
        .asObservable()
        .publish(applyMiddleware)
        .share();

    Dispatcher.subscribe();

    Actions.onNext({tag: 'register', data: {
        middleware: {
            notBar(o) {
                return o
                    .filter(x => x.tag !== 'bar')
                    .takeUntil(o.filter(x => x.tag === 'unregister'));
            },
            router(o) {
                return o.map(function({tag, data}) {
                    if ([].indexOf(tag) !== -1) {
                        // mount
                    }
                });
            },
        },
    }})

    Rx.Observable.range(0, 10000).subscribe(Actions);
}

// ----------------------------------------------------------------------------

function applyMiddleware(o) {
    return o
        .filter(x => x.tag === 'register')
        .filter(x => _.has(x, 'data.middleware'))
        .flatMap(
            x => _.values(x.data.middleware),
            ({tag, data}, fn) => ({tag, data, fn}))
        .scan((acc, cur) => acc.let(cur.fn), o)
        .flatMapLatest(x => x);
}
