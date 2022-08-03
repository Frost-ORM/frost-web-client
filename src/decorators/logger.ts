export const MethodLogger = (...prefix):MethodDecorator => {
  return (target,key,descriptor)=>{
    Object.defineProperty(target,key,{
      ...descriptor,
      value:(...args)=>{
        let output = target[key]?.(...args)
        console.log(...prefix,{name:key,arguments:args,output})
        return output
      }
    })
  }

}
