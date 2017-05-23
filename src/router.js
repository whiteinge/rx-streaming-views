import * as Rx from 'rx';
import {fnmatch} from 'rx-bytag';

/**
Match incoming tags against a map of view observables

For any matching tags, subscribe to the corresponding view observable before
passing the tag through. Unsubscribes to the previous view and emits an extra
tag indicating that the current view has been changed.
**/
export function makeRouter(changedTag, routes$, matchOb) {
    return function router(o) {
        var currentView = new Rx.SerialDisposable();

        return o
            .withLatestFrom(routes$)
            .flatMap(function([{tag, data}, routeMap]) {
                var ret = Rx.Observable.just({tag, data});

                var {obs$, modID} = routeMap[tag] || {};
                if (obs$) {
                    // The view obs must be subscribed before the tag emits.
                    currentView.setDisposable(obs$.subscribe(matchOb));
                    ret = Rx.Observable
                        .just({tag: changedTag, data: {modID, tag, data}})
                        .concat(ret);
                }

                return ret;
            });
    };
}

/**
Add and remove routes from the routes map; indexed by tag for fast lookup

Usage:
    var allRoutes$ = Dispatcher
        .let(collectRoutes(C.REGISTER, C.UNREGISTER))
        .shareReplay(1);
**/
export function collectRoutes(addTag, removeTag) {
    var matchAdd = fnmatch(addTag),
        matchRm = fnmatch(removeTag);

    return function(o) {
        var matches = Rx.Observable.merge([
            o.filter(({tag, data}) => matchAdd(tag) && data.routes)
                .map(({data}) => ({data, fn: add})),
            o.filter(({tag}) => matchRm(tag))
                .map(({data}) => ({data, fn: remove})),
        ]);

        return matches
            .scan((acc, {fn, data}) => fn(acc, data), {})
            .startWith({});
    };
}

function add(acc, {modID, routes}) {
    routes.forEach(function({obs$, tag}) {
        if (!obs$) { return; }
        acc[tag] = {modID, obs$};
    });
    return acc;
}

function remove(acc, data) {
    Object.keys(acc).forEach(function(key) {
        var val = acc[key];
        if (val.modID === data.modID) {
            delete acc[key];
        }
    });
    return acc;
}
