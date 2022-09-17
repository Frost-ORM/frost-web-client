import {  Relation } from "./relation";
import {describe, expect, test} from '@jest/globals';
import { ModelWithEnhancedRelations } from "../global-types";

const TestFrostModels: Record<string,ModelWithEnhancedRelations> = {
    "Student": {
        "path": "/testing/students",
        "name": "Student",
        "properties": [
            {
                "name": "name",
                "type": "string",
                "isArray": false,
                "optional": false
            },
            {
                "name": "year",
                "type": "SchoolYear",
                "isArray": false,
                "optional": false
            },
            {
                "name": "birthday",
                "type": "Date",
                "isArray": false,
                "optional": true
            },
            {
                "name": "email",
                "type": "string",
                "isArray": false,
                "optional": true
            },
            {
                "name": "courses",
                "type": "Course",
                "isArray": true,
                "optional": false
            },
            {
                "name": "club",
                "type": "Club",
                "isArray": false,
                "optional": false
            }
        ],
        "relations": [
            {
                "name": "student-course",
                "foreignModelName": "Course",
                "localField": {
                    "name": "courses",
                    "isArray": true
                },
                "localModelName": "Student",
                "defined": true,
                "foreignField": {
                    "name": "students",
                    "isArray": true
                },
                "relationType": "many_to_many",
                "localModel": {
                    "name": "Student",
                    "path": "/testing/students",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "year",
                            "type": "SchoolYear",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "birthday",
                            "type": "Date",
                            "isArray": false,
                            "optional": true
                        },
                        {
                            "name": "email",
                            "type": "string",
                            "isArray": false,
                            "optional": true
                        },
                        {
                            "name": "courses",
                            "type": "Course",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "club",
                            "type": "Club",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                },
                "foreignModel": {
                    "name": "Course",
                    "path": "/testing/courses",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "difficultyLevel",
                            "type": "DifficultyLevel",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "duration",
                            "type": "Duration",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "department",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "students",
                            "type": "Student",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "professor",
                            "type": "Professor",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                }
            },
            {
                "name": "student-club",
                "foreignModelName": "Club",
                "localField": {
                    "name": "club",
                    "isArray": false
                },
                "localModelName": "Student",
                "defined": true,
                "foreignField": {
                    "name": "members",
                    "isArray": true
                },
                "relationType": "one_to_many",
                "localModel": {
                    "name": "Student",
                    "path": "/testing/students",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "year",
                            "type": "SchoolYear",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "birthday",
                            "type": "Date",
                            "isArray": false,
                            "optional": true
                        },
                        {
                            "name": "email",
                            "type": "string",
                            "isArray": false,
                            "optional": true
                        },
                        {
                            "name": "courses",
                            "type": "Course",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "club",
                            "type": "Club",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                },
                "foreignModel": {
                    "name": "Club",
                    "path": "/testing/clubs",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "type",
                            "type": "ClubType",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "roomId",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "members",
                            "type": "Student",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "supervisor",
                            "type": "Professor",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                }
            }
        ]
    },
    "Professor": {
        "path": "/testing/professors",
        "name": "Professor",
        "properties": [
            {
                "name": "name",
                "type": "string",
                "isArray": false,
                "optional": false
            },
            {
                "name": "contactInfo",
                "type": "ContactInfo",
                "isArray": false,
                "optional": true
            },
            {
                "name": "department",
                "type": "string",
                "isArray": false,
                "optional": false
            },
            {
                "name": "email",
                "type": "string",
                "isArray": false,
                "optional": false
            },
            {
                "name": "courses",
                "type": "Course",
                "isArray": true,
                "optional": false
            },
            {
                "name": "club",
                "type": "Club",
                "isArray": false,
                "optional": false
            }
        ],
        "relations": [
            {
                "name": "professor-course",
                "foreignModelName": "Course",
                "localField": {
                    "name": "courses",
                    "isArray": true
                },
                "localModelName": "Professor",
                "defined": true,
                "foreignField": {
                    "name": "professor",
                    "isArray": false
                },
                "relationType": "one_to_many",
                "localModel": {
                    "name": "Professor",
                    "path": "/testing/professors",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "contactInfo",
                            "type": "ContactInfo",
                            "isArray": false,
                            "optional": true
                        },
                        {
                            "name": "department",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "email",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "courses",
                            "type": "Course",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "club",
                            "type": "Club",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                },
                "foreignModel": {
                    "name": "Course",
                    "path": "/testing/courses",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "difficultyLevel",
                            "type": "DifficultyLevel",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "duration",
                            "type": "Duration",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "department",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "students",
                            "type": "Student",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "professor",
                            "type": "Professor",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                }
            },
            {
                "name": "professor-club",
                "foreignModelName": "Club",
                "localField": {
                    "name": "club",
                    "isArray": false
                },
                "localModelName": "Professor",
                "defined": true,
                "foreignField": {
                    "name": "supervisor",
                    "isArray": false
                },
                "relationType": "one_to_one",
                "localModel": {
                    "name": "Professor",
                    "path": "/testing/professors",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "contactInfo",
                            "type": "ContactInfo",
                            "isArray": false,
                            "optional": true
                        },
                        {
                            "name": "department",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "email",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "courses",
                            "type": "Course",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "club",
                            "type": "Club",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                },
                "foreignModel": {
                    "name": "Club",
                    "path": "/testing/clubs",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "type",
                            "type": "ClubType",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "roomId",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "members",
                            "type": "Student",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "supervisor",
                            "type": "Professor",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                }
            }
        ]
    },
    "Course": {
        "path": "/testing/courses",
        "name": "Course",
        "properties": [
            {
                "name": "name",
                "type": "string",
                "isArray": false,
                "optional": false
            },
            {
                "name": "difficultyLevel",
                "type": "DifficultyLevel",
                "isArray": false,
                "optional": false
            },
            {
                "name": "duration",
                "type": "Duration",
                "isArray": false,
                "optional": false
            },
            {
                "name": "department",
                "type": "string",
                "isArray": false,
                "optional": false
            },
            {
                "name": "students",
                "type": "Student",
                "isArray": true,
                "optional": false
            },
            {
                "name": "professor",
                "type": "Professor",
                "isArray": false,
                "optional": false
            }
        ],
        "relations": [
            {
                "name": "student-course",
                "foreignModelName": "Student",
                "localField": {
                    "name": "students",
                    "isArray": true
                },
                "localModelName": "Course",
                "defined": true,
                "foreignField": {
                    "name": "courses",
                    "isArray": true
                },
                "relationType": "many_to_many",
                "localModel": {
                    "name": "Course",
                    "path": "/testing/courses",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "difficultyLevel",
                            "type": "DifficultyLevel",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "duration",
                            "type": "Duration",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "department",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "students",
                            "type": "Student",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "professor",
                            "type": "Professor",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                },
                "foreignModel": {
                    "name": "Student",
                    "path": "/testing/students",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "year",
                            "type": "SchoolYear",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "birthday",
                            "type": "Date",
                            "isArray": false,
                            "optional": true
                        },
                        {
                            "name": "email",
                            "type": "string",
                            "isArray": false,
                            "optional": true
                        },
                        {
                            "name": "courses",
                            "type": "Course",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "club",
                            "type": "Club",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                }
            },
            {
                "name": "professor-course",
                "foreignModelName": "Professor",
                "localField": {
                    "name": "professor",
                    "isArray": false
                },
                "localModelName": "Course",
                "defined": true,
                "foreignField": {
                    "name": "courses",
                    "isArray": true
                },
                "relationType": "one_to_many",
                "localModel": {
                    "name": "Course",
                    "path": "/testing/courses",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "difficultyLevel",
                            "type": "DifficultyLevel",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "duration",
                            "type": "Duration",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "department",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "students",
                            "type": "Student",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "professor",
                            "type": "Professor",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                },
                "foreignModel": {
                    "name": "Professor",
                    "path": "/testing/professors",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "contactInfo",
                            "type": "ContactInfo",
                            "isArray": false,
                            "optional": true
                        },
                        {
                            "name": "department",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "email",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "courses",
                            "type": "Course",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "club",
                            "type": "Club",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                }
            }
        ]
    },
    "Club": {
        "path": "/testing/clubs",
        "name": "Club",
        "properties": [
            {
                "name": "name",
                "type": "string",
                "isArray": false,
                "optional": false
            },
            {
                "name": "type",
                "type": "ClubType",
                "isArray": false,
                "optional": false
            },
            {
                "name": "roomId",
                "type": "string",
                "isArray": false,
                "optional": false
            },
            {
                "name": "members",
                "type": "Student",
                "isArray": true,
                "optional": false
            },
            {
                "name": "supervisor",
                "type": "Professor",
                "isArray": false,
                "optional": false
            }
        ],
        "relations": [
            {
                "name": "student-club",
                "foreignModelName": "Student",
                "localField": {
                    "name": "members",
                    "isArray": true
                },
                "localModelName": "Club",
                "defined": true,
                "foreignField": {
                    "name": "club",
                    "isArray": false
                },
                "relationType": "one_to_many",
                "localModel": {
                    "name": "Club",
                    "path": "/testing/clubs",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "type",
                            "type": "ClubType",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "roomId",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "members",
                            "type": "Student",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "supervisor",
                            "type": "Professor",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                },
                "foreignModel": {
                    "name": "Student",
                    "path": "/testing/students",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "year",
                            "type": "SchoolYear",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "birthday",
                            "type": "Date",
                            "isArray": false,
                            "optional": true
                        },
                        {
                            "name": "email",
                            "type": "string",
                            "isArray": false,
                            "optional": true
                        },
                        {
                            "name": "courses",
                            "type": "Course",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "club",
                            "type": "Club",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                }
            },
            {
                "name": "professor-club",
                "foreignModelName": "Professor",
                "localField": {
                    "name": "supervisor",
                    "isArray": false
                },
                "localModelName": "Club",
                "defined": true,
                "foreignField": {
                    "name": "club",
                    "isArray": false
                },
                "relationType": "one_to_one",
                "localModel": {
                    "name": "Club",
                    "path": "/testing/clubs",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "type",
                            "type": "ClubType",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "roomId",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "members",
                            "type": "Student",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "supervisor",
                            "type": "Professor",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                },
                "foreignModel": {
                    "name": "Professor",
                    "path": "/testing/professors",
                    "properties": [
                        {
                            "name": "name",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "contactInfo",
                            "type": "ContactInfo",
                            "isArray": false,
                            "optional": true
                        },
                        {
                            "name": "department",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "email",
                            "type": "string",
                            "isArray": false,
                            "optional": false
                        },
                        {
                            "name": "courses",
                            "type": "Course",
                            "isArray": true,
                            "optional": false
                        },
                        {
                            "name": "club",
                            "type": "Club",
                            "isArray": false,
                            "optional": false
                        }
                    ]
                }
            }
        ]
    }
};

test('relations created properly from model', () => { 
    Object.values(TestFrostModels).forEach((model)=>{
        let relations = Relation.fromModel(model,"array")
        expect(relations.length).toBe(model.relations.length)
    })
 })
 
 test('Student :: WithSide', () => { 
    let model = TestFrostModels["Student"]
    let relations = Relation.fromModel(model,"map")

    let rel = relations['student-club'].withSide("Student")
    expect(rel.getSide(0).name).toBe('Student')
    expect(rel.localField).toBe('club')
    expect(rel.localReference).toBe('__frost__/one_to_many/club')
    
    expect(rel.getSide(1).name).toBe('Club')
    expect(rel.foreignField).toBe('members')
    expect(rel.foreignReference).toBe('__frost__/one_to_many/members')
    expect(rel.isMaster).toBe(false)
    expect(rel.isSlave).toBe(true)

    rel = relations['student-club'].withSide("Club")
    expect(rel.getSide(0).name).toBe('Club')
    expect(rel.getSide(1).name).toBe('Student')
    expect(rel.localField).toBe('members')
    expect(rel.foreignField).toBe('club')
    expect(rel.isMaster).toBe(true)
    expect(rel.isSlave).toBe(false)


    rel = relations['student-course'].withSide("Student")
    expect(rel.getSide(0).name).toBe('Student')
    expect(rel.getSide(1).name).toBe('Course')
    expect(rel.localField).toBe('courses')
    expect(rel.foreignField).toBe('students')


    rel = relations['student-course'].withSide("Course")
    expect(rel.getSide(0).name).toBe('Course')
    expect(rel.getSide(1).name).toBe('Student')
    expect(rel.localField).toBe('students')
    expect(rel.foreignField).toBe('courses')
    
 })
 
 test('Course :: WithSide', () => { 
    let model = TestFrostModels["Course"]
    let relations = Relation.fromModel(model,"map")

    let rel = relations['professor-course'].withSide("Course")
    expect(rel.localSide.name).toBe('Course')
    expect(rel.localField).toBe('professor')
    expect(rel.localReference).toBe('__frost__/one_to_many/professor')
    
    expect(rel.foreignSide.name).toBe('Professor')
    expect(rel.foreignField).toBe('courses')
    expect(rel.foreignReference).toBe('__frost__/one_to_many/courses')

    expect(rel.isMaster).toBe(false)
    expect(rel.isSlave).toBe(true)

    rel = relations['professor-course'].withSide("Professor")
    expect(rel.localSide.name).toBe('Professor')
    expect(rel.localField).toBe('courses')
    expect(rel.localReference).toBe('__frost__/one_to_many/courses')


    expect(rel.foreignSide.name).toBe('Course')
    expect(rel.foreignField).toBe('professor')
    expect(rel.foreignReference).toBe('__frost__/one_to_many/professor')
    
    expect(rel.isMaster).toBe(true)
    expect(rel.isSlave).toBe(false)


    rel = relations['student-course'].withSide("Student")
    expect(rel.localSide.name).toBe('Student')
    expect(rel.localField).toBe('courses')
    expect(rel.localReference).toBe('__frost__/many_to_many/courses')

    expect(rel.foreignSide.name).toBe('Course')
    expect(rel.foreignField).toBe('students')
    expect(rel.foreignReference).toBe('__frost__/many_to_many/students')



    rel = relations['student-course'].withSide("Course")
    expect(rel.localSide.name).toBe('Course')
    expect(rel.foreignSide.name).toBe('Student')
    expect(rel.localField).toBe('students')
    expect(rel.foreignField).toBe('courses')
    
 })