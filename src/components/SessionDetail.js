import React from 'react';
import { useParams } from 'react-router-dom';
import PartsList from './PartsList';

const SessionDetail = () => {
  const { id } = useParams();
  return (
    <div>
      <PartsList sessionId={id} />
    </div>
  );
};

export default SessionDetail;