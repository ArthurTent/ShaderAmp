import { createSlice } from '@reduxjs/toolkit'

export const visualizerSlice = createSlice({
  name: 'vizualizer',
  initialState: {
    shaderName:  'MusicalHeart.frag',
    showPreview: false
  },
  reducers: {
    setShaderName: (state, action) => {
      state.shaderName = action.payload;
    },
    setShowPreview: (state, action) => {
      state.showPreview = action.payload;
    }
  },
})

// Action creators are generated for each case reducer function
export const { setShaderName, setShowPreview } = visualizerSlice.actions

export default visualizerSlice.reducer