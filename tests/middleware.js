import * as Rx from 'rx';
import * as _ from 'lodash';
import * as collectionAssert from 'rx-collectionassert';
import * as test from 'tape';

var ReactiveTest = Rx.ReactiveTest;

import * as C from '../src/constants';

import {
    applyMiddleware,
} from '../src/middleware';

var registerEvents = [
    {tag: C.REGISTER, data: {
        modID: 'foo',
        middleware: {
            foo1: o => o.map(({tag, data}) => ({tag, data: _.toUpper(data)})),
            foo2: {
                fn: o => o.map(({tag, data}) => ({tag, data: _.lowerFirst(data)})),
                after: ['foo1'],
            },
        },
    }},
    {tag: C.REGISTER, data: {
        modID: 'bar',
        middleware: {
            bar1: {
                fn: o => o.map(({tag, data}) => ({tag, data: _.repeat(data, 2)})),
                before: [['foo', 'foo1']],
            },
        },
    }},
];

var unRegisterEvents = [
    {tag: C.UNREGISTER, data: {modID: 'bar'}},
];

test.skip('addRemoveMiddleware', function(assert) {
    var stream = registerEvents.concat(unRegisterEvents);
    var ret = _.reduce(stream, addRemoveMiddleware, {});

    assert.ok(ret.hasOwnProperty('foo_|-foo1'));
    assert.ok(ret.hasOwnProperty('foo_|-foo2'));
    assert.notOk(ret.hasOwnProperty('bar_|-bar1'));
    assert.end();
});

test.skip('sortMWByDeps', function(assert) {
    var stream = _.reduce(registerEvents, addRemoveMiddleware, {});
    var ret = _.map(sortMWByDeps(stream), mw => `${mw.modID}_|-${mw.name}`);

    assert.deepEqual(ret, ['bar_|-bar1', 'foo_|-foo1', 'foo_|-foo2']);
    assert.end();
});

test('Full middleware pipeline', function(assert) {
    var scheduler = new Rx.TestScheduler();

    var source = scheduler.createHotObservable(
        ReactiveTest.onNext(250, registerEvents[0]),
        ReactiveTest.onNext(260, registerEvents[1]),
        ReactiveTest.onNext(270, {tag: 'foo', data: 'foo'}),
        ReactiveTest.onNext(280, unRegisterEvents[0]),
        ReactiveTest.onNext(290, {tag: 'foo', data: 'foo'}));

    var ret = scheduler.startScheduler(function() {
        return source.publish(applyMiddleware(C)).share();
    }, {created: 100, subscribed: 200, disposed: 500});

    collectionAssert.assertEqual(ret.messages, [
        ReactiveTest.onNext(250, registerEvents[0]), // no test
        ReactiveTest.onNext(260, registerEvents[1]), // no test
        ReactiveTest.onNext(270, {tag: 'foo', data: 'fOOFOO'}),
        ReactiveTest.onNext(280, unRegisterEvents[0]), // no test
        ReactiveTest.onNext(290, {tag: 'foo', data: 'fOO'}),
    ]);

    assert.end();
});
