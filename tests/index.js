import * as Rx from 'rx';
import * as _ from 'lodash';
import * as test from 'tape';

import {getRSV} from '../src';

var ReactiveTest = Rx.ReactiveTest;

test('Dispatcher send', function(assert) {
    var {Dispatcher, send} = getRSV({appID: 'myapp'});

    var sub = Dispatcher.subscribe(function(x) {
        assert.deepEqual(x, {tag: 'foo', data: 'Foo'});
        assert.end();
    });

    send('foo')('Foo');
});

test('Namespaced constants', function(assert) {
    var {C} = getRSV({appID: 'myapp'});

    assert.equal(C.REGISTER, 'myapp/core/register');
    assert.end();
});

test('Logger', function(assert) {
    var {Dispatcher, getLogger} = getRSV({appID: 'myapp'});

    var sub = Dispatcher.subscribe(function(x) {
        assert.deepEqual(x, {tag: 'myapp/module1/log/debug', data: {message: 'Foo'}});
        assert.end();
    });

    var log = getLogger('module1');
    log.debug('Foo');
});
