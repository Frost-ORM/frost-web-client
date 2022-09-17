import { flattenObject } from "./object-methods";

test('flattenObject', () => { 
    const testObject = {
        a:1,
        b:2,
        c:3
    }

    let flattenedObject = flattenObject(testObject,'/','/test')

    expect(flattenedObject['/test/a']).toBe(1)
    expect(flattenedObject['/test/b']).toBe(2)
    expect(flattenedObject['/test/c']).toBe(3)
 })
test('flattenObject:depth', () => { 
    const testObject = {
        a:{
            a:1,
            b:2,
            c:3
        },
        b:{
            a:{
                a:null,
                b:2,
                c:3
            }
        },
        c:{//1
            a:{//2
                a:{//3
                    a:{//4
                        a:1,//5
                        b:2,
                        c:3
                    },
                    b:2,
                    c:3
                },
                b:2,
                c:3
            }
        }
    }

    let flattenedObject = flattenObject(testObject,'/','/test',5)

    expect(flattenedObject['/test/a/a']).toBe(1)
    expect(flattenedObject['/test/a/b']).toBe(2)
    expect(flattenedObject['/test/a/c']).toBe(3)
    expect(flattenedObject['/test/b/a/a']).toBe(null)
    expect(flattenedObject['/test/c/a/a/a/a']).toBe(1)

    flattenedObject = flattenObject(testObject,'/',undefined,5)

    expect(flattenedObject['a/a']).toBe(1)
    expect(flattenedObject['a/b']).toBe(2)
    expect(flattenedObject['a/c']).toBe(3)
    expect(flattenedObject['b/a/b']).toBe(2)
    expect(flattenedObject['c/a/a/a/a']).toBe(1)
 })