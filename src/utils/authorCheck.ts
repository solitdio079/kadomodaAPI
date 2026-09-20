function checkIfAuthor(id:number, userId:number):boolean{
    if(id !== userId) return false
    return true
}

export default checkIfAuthor