import 'jest-extended'
import 'reflect-metadata';
import {
    arrayBufferFrom,
    arrayBufferTo,
    arrayBufferToBase64,
    f,
    ParentReference,
    partialPlainToClass,
} from "@marcj/marshal";
import {Plan, SimpleModel, SubModel} from "@marcj/marshal/tests/entities";
import {Binary, ObjectID} from "mongodb";
import {
    classToMongo,
    mongoToClass,
    partialClassToMongo,
    partialMongoToPlain,
    partialPlainToMongo,
    plainToMongo
} from "../src/mapping";
import {Buffer} from "buffer";
import {DocumentClass} from "@marcj/marshal/tests/document-scenario/DocumentClass";
import {PageCollection} from "@marcj/marshal/tests/document-scenario/PageCollection";
import {PageClass} from "@marcj/marshal/tests/document-scenario/PageClass";

test('test simple model', () => {
    const instance = new SimpleModel('myName');
    const mongo = classToMongo(SimpleModel, instance);

    expect(mongo['id']).toBeInstanceOf(Binary);
    expect(mongo['name']).toBe('myName');

});

test('test simple model all fields', () => {
    const instance = new SimpleModel('myName');
    instance.plan = Plan.PRO;
    instance.type = 5;
    instance.created = new Date('Sat Oct 13 2018 14:17:35 GMT+0200');
    instance.children.push(new SubModel('fooo'));
    instance.children.push(new SubModel('barr'));

    instance.childrenMap.foo = new SubModel('bar');
    instance.childrenMap.foo2 = new SubModel('bar2');

    const mongo = classToMongo(SimpleModel, instance);

    expect(mongo['id']).toBeInstanceOf(Binary);
    expect(mongo['name']).toBe('myName');
    expect(mongo['type']).toBe(5);
    expect(mongo['plan']).toBe(Plan.PRO);
    expect(mongo['created']).toBeDate();
    expect(mongo['children']).toBeArrayOfSize(2);
    expect(mongo['children'][0]).toBeObject();
    expect(mongo['children'][0].label).toBe('fooo');
    expect(mongo['children'][1].label).toBe('barr');

    expect(mongo['childrenMap']).toBeObject();
    expect(mongo['childrenMap'].foo).toBeObject();
    expect(mongo['childrenMap'].foo.label).toBe('bar');
    expect(mongo['childrenMap'].foo2.label).toBe('bar2');
});

test('make sure undefined is undefined', () => {
    expect(undefined).toBeUndefined();
    expect(null).not.toBeUndefined();

    class Model {
        constructor(
            @f.optional()
            public name?: string) {
        }
    }

    {
        const mongo = classToMongo(Model, new Model('peter'));
        expect(mongo.name).toBe('peter');
    }

    {
        const mongo = classToMongo(Model, new Model(undefined));
        expect(mongo.name).toBeUndefined();
    }

    {
        const mongo = classToMongo(Model, new Model());
        expect(mongo.name).toBeUndefined();
    }

    {
        const mongo = plainToMongo(Model, {name: 'peter'});
        expect(mongo.name).toBe('peter');
    }

    {
        const mongo = plainToMongo(Model, {name: undefined});
        expect(mongo.name).toBeUndefined();
    }

    {
        const mongo = plainToMongo(Model, {});
        expect(mongo.name).toBeUndefined();
    }
});

test('convert IDs and invalid values', () => {
    enum Enum {
        first,
        second,
    }

    class Model {
        @f.mongoId()
        id2?: string;

        @f.uuid()
        uuid?: string;

        @f.enum(Enum)
        enum?: Enum;
    }

    const instance = new Model();
    instance.id2 = '5be340cb2ffb5e901a9b62e4';

    const mongo = classToMongo(Model, instance);
    expect(mongo.id2).toBeInstanceOf(ObjectID);
    expect(mongo.id2.toHexString()).toBe('5be340cb2ffb5e901a9b62e4');

    expect(() => {
        const instance = new Model();
        instance.id2 = 'notavalidId';
        const mongo = classToMongo(Model, instance);
    }).toThrow('Invalid ObjectID given in property id2');

    expect(() => {
        const instance = new Model();
        instance.uuid = 'notavalidId';
        const mongo = classToMongo(Model, instance);
    }).toThrow('Invalid UUID v4 given');
});


test('binary', () => {
    class Model {
        @f.type(ArrayBuffer)
        preview: ArrayBuffer = arrayBufferFrom('FooBar', 'utf8');
    }

    const i = new Model();
    expect(Buffer.from(i.preview).toString('utf8')).toBe('FooBar');

    const mongo = classToMongo(Model, i);
    expect(mongo.preview).toBeInstanceOf(Binary);
    expect((mongo.preview as Binary).length()).toBe(6);
});


test('binary from mongo', () => {
    class Model {
        @f.type(ArrayBuffer)
        preview: ArrayBuffer = arrayBufferFrom('FooBar', 'utf8');
    }

    const i = mongoToClass(Model, {
        preview: new Binary(Buffer.from('FooBar', 'utf8'))
    });

    expect(i.preview.byteLength).toBe(6);
    expect(arrayBufferTo(i.preview, 'utf8')).toBe('FooBar');
});


test('partial 2', () => {
    const instance = partialClassToMongo(SimpleModel, {
        name: 'Hi',
        'children.0.label': 'Foo'
    });

    expect(instance).not.toBeInstanceOf(SimpleModel);
    expect(instance['id']).toBeUndefined();
    expect(instance['type']).toBeUndefined();
    expect(instance.name).toBe('Hi');
    expect(instance['children.0.label']).toBe('Foo');

    {
        expect(partialClassToMongo(SimpleModel, {
            'children.0.label': 2
        })).toEqual({'children.0.label': '2'});

        const i = partialClassToMongo(SimpleModel, {
            'children.0': new SubModel('3')
        });
        expect(i['children.0'].label).toBe('3');
    }

    {
        expect(partialPlainToMongo(SimpleModel, {
            'children.0.label': 2
        })).toEqual({'children.0.label': '2'});


        const i = partialPlainToClass(SimpleModel, {
            'children.0': {label: 3}
        });
        expect(i['children.0']).toBeInstanceOf(SubModel);
        expect(i['children.0'].label).toBe('3');

        const i2 = partialPlainToMongo(SimpleModel, {
            'children.0': {label: 3}
        });
        expect(i2['children.0'].label).toBe('3');
    }
});


test('partial 3', () => {
    {
        const i = partialClassToMongo(SimpleModel, {
            'children': [new SubModel('3')]
        });
        expect(i['children'][0].label).toBe('3');
    }

    {
        const i = partialPlainToMongo(SimpleModel, {
            'children': [{label: 3}]
        });
        expect(i['children'][0].label).toBe('3');
    }
});

test('partial with required doesnt throw', () => {
    {
            partialPlainToMongo(SimpleModel, {
                'children': [{}]
            })
    }
});


test('partial 4', () => {
    {
        const i = partialClassToMongo(SimpleModel, {
            'stringChildrenCollection.0': 4
        });
        expect(i['stringChildrenCollection.0']).toBe('4');
    }
    {
        const i = partialPlainToMongo(SimpleModel, {
            'stringChildrenCollection.0': 4
        });
        expect(i['stringChildrenCollection.0']).toBe('4');
    }
});

test('partial 5', () => {
    {
        const i = partialClassToMongo(SimpleModel, {
            'childrenMap.foo.label': 5
        });
        expect(i['childrenMap.foo.label']).toBe('5');
    }
    {
        const i = partialPlainToMongo(SimpleModel, {
            'childrenMap.foo.label': 5
        });
        expect(i['childrenMap.foo.label']).toBe('5');
    }
});


test('partial 6', () => {
    {
        const i = partialClassToMongo(SimpleModel, {
            'types': [6, 7]
        });
        expect(i['types']).toEqual(['6', '7']);
    }
    {
        const i = partialPlainToMongo(SimpleModel, {
            'types': [6, 7]
        });
        expect(i['types']).toEqual(['6', '7']);
    }
});

test('partial 7', () => {
    {
        const i = partialClassToMongo(SimpleModel, {
            'types.0': [7]
        });
        expect(i['types.0']).toEqual('7');
    }
    {
        const i = partialPlainToMongo(SimpleModel, {
            'types.0': [7]
        });
        expect(i['types.0']).toEqual('7');
    }
});

test('partial invalid', () => {

    expect(() => {
        partialPlainToMongo(SimpleModel, {
            id: 'invalid-id'
        });
    }).toThrow('Invalid UUID v4 given in property id');

    expect(() => {
        partialClassToMongo(SimpleModel, {
            id: 'invalid-id'
        });
    }).toThrow('Invalid UUID v4 given in property id');

    expect(() => {
        partialPlainToMongo(DocumentClass, {
            _id: 'invalid-id'
        });
    }).toThrow('Invalid ObjectID given in property _id');

    expect(() => {
        partialClassToMongo(DocumentClass, {
            _id: 'invalid-id'
        });
    }).toThrow('Invalid ObjectID given in property _id');

    {
        const m = partialClassToMongo(DocumentClass, {
            _id: null
        });

        expect(m._id).toBeNull();
    }

    {
        const m = partialPlainToMongo(DocumentClass, {
            _id: null,
        });

        expect(m._id).toBeNull();
    }

    partialPlainToMongo(DocumentClass, {
        _id: undefined
    });
    partialPlainToMongo(DocumentClass, {
        _id: undefined
    });
});

test('partial does not fail, that is the job of validation', () => {
    plainToMongo(SimpleModel, new SimpleModel('peter'));

    mongoToClass(SimpleModel, {
        name: 'peter',
        children: [new SubModel('p')]
    });

    plainToMongo(SimpleModel, {
        name: 'peter',
        children: [
            {name: 'p'},
            {age: 2},
            {}
        ]
    });
});


test('partial any does not copy ', () => {
    const anyV = {'peter': 1};

    const m = plainToMongo(SimpleModel, {
        name: 'peter',
        anyField: anyV
    });

    expect(m.anyField).toBe(anyV);
});

test('partial mongo to plain ', () => {
    class User {
        @f
        name?: string;

        @f.array(String)
        tags?: string[];

        @f.optional()
        picture?: ArrayBuffer;

        @f.forward(() => User).optional()
        @ParentReference()
        parent?: User;
    }

    {
        const u = plainToMongo(User, {
            name: 'peter',
            picture: null,
            tags: {},
            parent: {name: 'Marie'}
        });

        expect(u.name).toBe('peter');
        expect(u.picture).toBe(undefined);
        expect(u.tags).toEqual([]);
        expect(u.parent).toBeUndefined();
    }

    {
        const u = mongoToClass(User, {
            name: 'peter',
            picture: null,
            tags: {},
            parent: {name: 'Marie'}
        });

        expect(u.name).toBe('peter');
        expect(u.picture).toBeUndefined();
        expect(u.tags).toEqual([]);
        expect(u.parent).toBeUndefined();
    }

    const bin = arrayBufferFrom('Hello', 'utf8');

    {
        const m = partialMongoToPlain(User, {
            name: undefined,
            picture: null,
            tags: {}
        });

        expect(m.name).toBe(undefined);
        expect(m.picture).toBe(null);
        expect(m.tags).toBeArray();
    }

    {
        const m = partialClassToMongo(User, {
            name: undefined,
            picture: null,
            parent: new User(),
            tags: {}
        });

        expect(m.name).toBe(undefined);
        expect(m.picture).toBe(null);
        expect(m.parent).toBeUndefined();
        expect(m.tags).toBeArray();
    }

    {
        const m = partialMongoToPlain(User, {
            picture: new Binary(Buffer.from(bin)),
            name: 'peter'
        });

        expect(m.name).toBe('peter');
        expect(m.picture).toBe(arrayBufferToBase64(bin));
    }

    {
        const m = partialClassToMongo(User, {
            picture: bin,
            name: 'peter'
        });

        expect(m.name).toBe('peter');
        expect(m.picture).toBeInstanceOf(Binary);
        expect(m.picture.buffer.toString('base64')).toBe(arrayBufferToBase64(bin));
    }

    {
        const m = partialPlainToMongo(User, {
            picture: arrayBufferToBase64(bin),
            name: 'peter',
            tags: {}
        });

        expect(m.name).toBe('peter');
        expect(m.picture).toBeInstanceOf(Binary);
        expect(m.picture.buffer.toString('base64')).toBe(arrayBufferToBase64(bin));
        expect(m.tags).toBeArray();
    }
});

test('partial document', () => {
    const doc = new DocumentClass;
    const document = partialClassToMongo(DocumentClass, {
        'pages.0.name': 5,
        'pages.0.children.0.name': 6,
        'pages.0.children': new PageCollection([new PageClass(doc, '7')])
    });
    expect(document['pages.0.name']).toBe('5');
    expect(document['pages.0.children.0.name']).toBe('6');
    expect(document['pages.0.children']).toBeInstanceOf(Array);
    expect(document['pages.0.children'][0].name).toBe('7');
});
