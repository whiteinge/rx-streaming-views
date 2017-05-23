import * as Rx from 'rx';
import * as _ from 'lodash';
import * as collectionAssert from 'rx-collectionassert';
import * as test from 'tape';

var ReactiveTest = Rx.ReactiveTest;

import {makeRouter, collectRoutes} from '../src/router';

const C = {
    REGISTER: 'register',
    UNREGISTER: 'unregister',
    VIEW_CHANGED: 'view_changed',
    FOO: 'foo',
    BAR: 'bar',
    BAZ: 'baz',
};

var testScript = Rx.Observable.from([
    {tag: C.REGISTER, data: {modID: 'test1', routes: [
        {path: '/foo', tag: C.FOO, obs$: Rx.Observable.just('foo')},
        {path: '/baz', tag: C.BAZ, obs$: Rx.Observable.just('baz')},
    ]}},
    {tag: C.FOO},
    {tag: C.BAR},
    {tag: C.BAZ},
    {tag: C.UNREGISTER, data: {modID: 'test1'}},
]);

test('collect routes', function(assert) {
    var matchOb = {
        onNext: x => console.log('next', x),
        onError: x => console.log('err', x),
        onCompleted: () => console.log('compl'),
    };

    var Actions = new Rx.Subject();

    var allRoutes$ = Actions
        .let(collectRoutes(C.REGISTER, C.UNREGISTER))
        .shareReplay(1);

    var routerFn = makeRouter(C.VIEW_CHANGED, allRoutes$, matchOb);
    Actions.publish(routerFn)
        .subscribe(() => {}, () => {}, () => assert.end());

    testScript.subscribe(Actions);
});
