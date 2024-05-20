import { Vector4 } from "three";

export const getCurrentDateVector = () => {
	const currentDate = new Date();
	// Year, month, day, time in seconds in .xyzw
	return new Vector4(currentDate.getFullYear(), currentDate.getMonth(),
		currentDate.getDate(),
		currentDate.getHours()*60.0*60 + currentDate.getMinutes()*60 + currentDate.getSeconds());
}

